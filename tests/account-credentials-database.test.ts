import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;const id=(n:number)=>`ad000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function as(n:number,sql:string,args:unknown[]=[],aal='aal2',session=id(100+n)){
 await db.exec('begin');try{await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[id(n),JSON.stringify({sub:id(n),aal,session_id:session})]);await db.exec('set local role authenticated');const r=await db.query(sql,args);await db.exec('commit');return r.rows as Record<string,unknown>[];}catch(e){await db.exec('rollback');throw e;}
}
async function finish(op:string,result:string,actor=id(1)){await db.exec('begin;set local role service_role');try{const r=await db.query('select public.finish_account_credential_change($1,$2,$3) result',[op,result,actor]);await db.exec('commit');return (r.rows[0] as {result:{status:string}}).result;}catch(e){await db.exec('rollback');throw e;}}
async function fresh(n:number){await db.query('update auth.sessions set created_at=clock_timestamp() where id=$1',[id(100+n)]);}
const begin=(n:number,op:number,action='password',email:string|null=null)=>as(1,'select public.begin_account_credential_change($1,$2,$3,$4,$5,$6)',[id(op),id(n),action,`user${n}@example.test`,email,'Verified account holder request']);
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../supabase/bootstrap/new-test-project.sql',import.meta.url),'utf8'));
 for(let n=1;n<=6;n++){await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id(n),`user${n}@example.test`]);await db.query('insert into auth.sessions values($1,$2,now())',[id(100+n),id(n)]);}
 await db.query("insert into public.staff_members(user_id,role) values($1,'admin'),($2,'operator'),($3,'admin')",[id(1),id(2),id(6)]);
 await db.query("insert into public.staff_unit_roles(user_id,unit_code,role) values($1,'zhidian_cn','finance_preparer')",[id(2)]);
 await db.query("insert into public.organizations(id,name) values($1,'Fictional company')",[id(50)]);
 await db.query("insert into public.client_wallets(id,organization_id,currency) values($1,$2,'CNY')",[id(51),id(50)]);
 await db.query("insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values($1,$2,'CNY','topup',70323,'Fictional balance','CREDENTIAL-TEST-ONLY')",[id(51),id(50)]);
 for(const n of [3,5])await as(1,"select public.set_live_account_access($1,$2,'client','Fictional client',$3,true,0,'Verified test account')",[id(n),id(50),`user${n}@example.test`]);
 await db.query("insert into public.partner_agents(user_id,label,expected_email,active,agreement,created_by) values($1,'Fictional agent',$2,true,'Verified fiction',$3)",[id(4),'user4@example.test',id(1)]);
 for(const n of [3,4,5])await fresh(n);
},30000);
afterAll(async()=>{await db?.close();});
it('shows managed role metadata only to MFA administrators and refuses self or unknown targets',async()=>{
 const list=(await as(1,'select public.list_managed_accounts() data'))[0].data as unknown[];expect(list).toHaveLength(6);expect(JSON.stringify(list)).not.toMatch(/encrypted_password|refresh_token/);
 for(const n of [2,3,4])await expect(as(n,'select public.list_managed_accounts()')).rejects.toThrow(/Forbidden/);
 await expect(as(1,'select public.list_managed_accounts()',[],'aal1')).rejects.toThrow(/Forbidden/);
 await expect(begin(1,200)).rejects.toThrow(/Forbidden/);await expect(begin(99,200)).rejects.toThrow(/Unknown/);
});
it('locks a client during Auth updates, rejects retries and preserves company/role when repinning email',async()=>{
 const op=id(201);await begin(3,201,'email','new-client@example.test');await expect(as(3,'select public.get_live_account_context(false)')).rejects.toThrow();await expect(begin(3,202)).rejects.toThrow(/conflict/);
 await expect(as(1,"select public.finish_account_credential_change($1,'succeeded')",[op])).rejects.toThrow(/permission denied/);
 await db.query('update auth.users set email=$1 where id=$2',['new-client@example.test',id(3)]);expect(await finish(op,'succeeded')).toEqual({status:'succeeded'});
 await expect(as(3,'select public.get_live_account_context(false)')).rejects.toThrow(/unavailable|sign-in/);await fresh(3);expect((await as(3,'select public.get_live_account_context(false) data'))[0].data).toMatchObject({role:'client',organization_id:id(50)});
 expect((await db.query('select expected_email,active,note from public.live_access_accounts where user_id=$1',[id(3)])).rows[0]).toEqual({expected_email:'new-client@example.test',active:true,note:'Verified test account'});
});
it('invalidates staff access after a password reset without changing assigned finance duties',async()=>{
 expect((await as(2,"select public.has_ops_capability('finance.prepare') allowed"))[0].allowed).toBe(true);await begin(2,203);expect((await as(2,"select public.has_ops_capability('finance.prepare') allowed"))[0].allowed).toBe(false);
 await finish(id(203),'succeeded');expect((await as(2,"select public.has_ops_capability('finance.prepare') allowed"))[0].allowed).toBe(false);await fresh(2);expect((await as(2,"select public.has_ops_capability('finance.prepare') allowed"))[0].allowed).toBe(true);
});
it('maintains other administrators and agents, retaining their roles and rejecting old sessions',async()=>{
 await begin(6,204);await finish(id(204),'succeeded');expect((await as(6,"select public.has_staff_access(array['admin']::text[]) allowed"))[0].allowed).toBe(false);await fresh(6);expect((await as(6,"select public.has_staff_access(array['admin']::text[]) allowed"))[0].allowed).toBe(true);
 await begin(4,205,'email','new-agent@example.test');await db.query('update auth.users set email=$1 where id=$2',['new-agent@example.test',id(4)]);await finish(id(205),'succeeded');await expect(as(4,'select public.get_live_account_context(false)')).rejects.toThrow();await fresh(4);expect((await as(4,'select public.get_live_account_context(false) data'))[0].data).toMatchObject({role:'agent'});
});
it('keeps uncertain changes locked until a privileged reconciliation, and never audits password material',async()=>{
 await begin(5,206);expect(await finish(id(206),'uncertain')).toEqual({status:'uncertain'});await expect(finish(id(206),'reconciled')).rejects.toThrow(/still running/);await db.query("update public.account_credential_operations set started_at=now()-interval '2 minutes' where id=$1",[id(206)]);expect(await finish(id(206),'reconciled',id(6))).toEqual({status:'reconciled'});await fresh(5);expect((await as(5,'select public.get_live_account_context(false) data'))[0].data).toMatchObject({role:'client'});
 expect((await db.query("select finished_by from public.account_credential_operations where id=$1",[id(206)])).rows[0]).toEqual({finished_by:id(6)});
 expect(JSON.stringify((await db.query("select changes from public.audit_events where entity_type='account_credentials'")).rows)).not.toMatch(/password_hash|password_value|secret|example\.test|Verified account holder/);
});

it('does not mark an unverified email update successful or change any posted money',async()=>{
 await as(1,'select public.begin_account_credential_change($1,$2,$3,$4,$5,$6)',[id(207),id(3),'email','new-client@example.test','never-updated@example.test','Verified request']);
 expect(await finish(id(207),'succeeded')).toEqual({status:'uncertain'});
 expect((await db.query('select expected_email from public.live_access_accounts where user_id=$1',[id(3)])).rows[0]).toEqual({expected_email:'new-client@example.test'});
 expect((await db.query('select sum(amount_minor)::text amount from public.wallet_entries where wallet_id=$1',[id(51)])).rows[0]).toEqual({amount:'70323'});
});

it('allows investor AAL1 reads after 054 while keeping writes and staff MFA restricted',async()=>{
 for(const [n,role] of [[7,'investor'],[8,'sales']] as const){await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id(n),`user${n}@example.test`]);await db.query('insert into auth.sessions values($1,$2,clock_timestamp())',[id(100+n),id(n)]);await as(1,"select public.set_live_account_access($1,$2,$3,'Fictional test role',$4,true,0,'Verified local fixture')",[id(n),id(50),role,`user${n}@example.test`]);await fresh(n);}
 expect((await as(7,'select public.get_live_account_context() c',[],'aal1'))[0].c).toMatchObject({role:'investor'});
 expect((await as(7,"select public.read_investor_business('organizations',0,25) d",[],'aal1'))[0].d).toHaveProperty('rows');
 await expect(as(7,"select public.request_client_topup($1,100,'FORGED')",[id(51)],'aal1')).rejects.toThrow();
 await expect(as(7,'select public.list_managed_accounts()',[],'aal1')).rejects.toThrow();
 await expect(as(8,'select public.get_live_account_context()',[],'aal1')).rejects.toThrow(/verification/);
 await expect(as(1,'select public.list_managed_accounts()',[],'aal1')).rejects.toThrow();
 await db.query('update public.live_access_accounts set active=false where user_id=$1',[id(7)]);await expect(as(7,'select public.get_live_account_context()',[],'aal1')).rejects.toThrow();
});
