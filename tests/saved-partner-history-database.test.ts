import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {applyMigrationsThrough} from './fixtures/migrations';
let db:PGlite;const uid=(n:number)=>`d0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;const org=uid(100),other=uid(101);let wallet:string,otherWallet:string,agent:string,policy:string;let seq=500;const sessions=new Map<number,string>();
async function as(n:number,sql:string,args:unknown[]=[],aal='aal2'){await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','${uid(n)}',true);select set_config('request.jwt.claims','${JSON.stringify({aal,session_id:sessions.get(n)})}',true);`);try{const r=await db.query<any>(sql,args);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
async function command(n:number,action:string,data:Record<string,unknown>,request=uid(seq++)){try{return (await as(n,'select public.partner_finance_action($1,$2,$3) data',[action,request,{note:'FICTIONAL TEST EVIDENCE',...data}]))[0].data;}catch(e){throw Error(`${n} ${action}: ${(e as Error).message}`)}}
beforeAll(async()=>{db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid,created_at timestamptz default clock_timestamp());create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;create schema storage;grant usage on schema storage to authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,unique(bucket_id,name));alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);await applyMigrationsThrough(db,48);
 for(let n=1;n<=8;n++){await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid(n),`partner${n}@example.test`]);}
 await db.query("insert into public.staff_members(user_id,role) values($1,'admin'),($2,'operator'),($3,'operator')",[uid(1),uid(2),uid(3)]);
 await db.query("insert into public.organizations(id,name) values($1,'FICTIONAL ASSIGNED COMPANY'),($2,'PRIVATE OTHER COMPANY')",[org,other]);
 await as(1,"select public.assign_operating_role($1,'zhidian_cn','finance_preparer',true)",[uid(2)]);await as(1,"select public.assign_operating_role($1,'zhidian_cn','finance_reviewer',true)",[uid(3)]);
 wallet=(await as(1,'select public.open_crm_wallet($1) id',[org]))[0].id;otherWallet=(await as(1,'select public.open_crm_wallet($1) id',[other]))[0].id;
 for(const [n,role,target] of [[4,'client',org],[6,'client',other],[7,'investor',org],[8,'sales',org]] as const)await as(1,'select public.set_live_account_access($1,$2,$3,$4,$5,true,0,$6)',[uid(n),target,role,'FIXTURE '+role,`partner${n}@example.test`,'FICTIONAL GRANT']);
 agent=(await command(1,'agent_save',{userId:uid(5),email:'partner5@example.test',label:'FICTIONAL AGENT',revision:0,active:false})).id;
 await command(1,'agent_save',{userId:uid(5),email:'partner5@example.test',label:'FICTIONAL AGENT',revision:1,active:true});
 for(let n=1;n<=8;n++)sessions.set(n,(await db.query<any>('insert into auth.sessions(user_id) values($1) returning id',[uid(n)])).rows[0].id);
 await db.query("insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values($1,$2,'CNY','topup',100000,'FICTIONAL CREDIT','FIXTURE-CREDIT')",[wallet,org]);
 policy=(await command(1,'refund_policy',{walletId:wallet,mode:'percent',value:250})).id;
},30000);
afterAll(async()=>{await db?.close()});

it('reads only whitelisted notes and preserves historical fee versions without exposing request payloads',async()=>{
 const target=uid(900);
 for(const [n,action,note] of [[2,'refund_prepare','PREPARER OWN NOTE'],[3,'refund_review','REVIEWER PRIVATE NOTE'],[1,'unknown_action','HIDDEN ACTION']] as const){await db.query('insert into public.partner_actions(actor_id,request_id,input,result) values($1,$2,$3,$4)',[uid(n),uid(seq++),{action,data:{note,bankReference:'SECRET BANK',password:'SECRET PASSWORD'}},{id:target,action}]);}
 const owner=(await as(1,'select public.read_saved_partner_history($1) data',[[target,wallet]]))[0].data;
 expect(owner.notes.map((n:any)=>n.note).sort()).toEqual(['PREPARER OWN NOTE','REVIEWER PRIVATE NOTE']);expect(JSON.stringify(owner)).not.toContain('SECRET');expect(owner.policies).toHaveLength(1);
 await command(1,'refund_policy',{walletId:wallet,mode:'fixed',value:100});
 const revised=(await as(1,'select public.read_saved_partner_history($1) data',[[wallet]]))[0].data;
 expect(revised.policies).toHaveLength(2);expect(revised.policies.filter((p:any)=>p.active)).toHaveLength(1);expect(revised.policies.find((p:any)=>!p.active).value).toBe(250);
 const own=(await as(2,'select public.read_saved_partner_history($1) data',[[target,wallet]]))[0].data;
 expect(own.notes.map((n:any)=>n.note)).toEqual(['PREPARER OWN NOTE']);expect(own.policies).toEqual([]);
 const unrelated=(await as(1,'select public.read_saved_partner_history($1) data',[[uid(901)]]))[0].data;expect(unrelated.notes).toEqual([]);expect(unrelated.policies).toEqual([]);
});
it('fails closed for external roles, AAL1, excessive scopes and a paused administrator',async()=>{
 for(const n of [4,5,6,7,8])await expect(as(n,'select public.read_saved_partner_history($1)',[[wallet]])).rejects.toThrow();
 await expect(as(1,'select public.read_saved_partner_history($1)',[[wallet]],'aal1')).rejects.toThrow();
 await expect(as(1,'select public.read_saved_partner_history($1)',[Array(501).fill(wallet)])).rejects.toThrow(/500/);
 await db.query('update public.staff_members set active=false where user_id=$1',[uid(1)]);
 await expect(as(1,'select public.read_saved_partner_history($1)',[[wallet]])).rejects.toThrow();
 await db.query('update public.staff_members set active=true where user_id=$1',[uid(1)]);
});

it('rejects a credential-locked staff session even when the administrator role is still assigned',async()=>{
 await db.query('insert into public.account_credential_state(user_id,locked) values($1,true)',[uid(1)]);
 await expect(as(1,'select public.read_saved_partner_history($1)',[[wallet]])).rejects.toThrow();
});
