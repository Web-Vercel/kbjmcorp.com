import {serviceReplyReceipt} from '@/lib/operations/service-reply';
import {PGlite} from '@electric-sql/pglite';import {randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';
import {beforeAll,afterAll,it,expect} from 'vitest';import {applyMigrationsThrough} from './fixtures/migrations';
let db:PGlite,legacy:string;const org='b0000000-0000-4000-8000-000000000001',other='b0000000-0000-4000-8000-000000000002';
const user=(n:number)=>`a0000000-0000-4000-8000-00000000000${n}`;
async function as(n:number,sql:string,args:unknown[]=[],aal='aal2'){
 await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','${user(n)}',true);select set_config('request.jwt.claims','{"aal":"${aal}"}',true);`);
 try{const result=await db.query<Record<string,any>>(sql,args);await db.exec('commit');return result.rows[0];}catch(e){await db.exec('rollback');throw e;}
}
async function create(){return String((await as(4,"select public.create_service_request($1,'billing','FICTIONAL QUESTION','FICTIONAL initial message') id",[org])).id);}
async function reply(n:number,ticket:string,key:string,body='FICTIONAL reply',status='in_progress',aal='aal2'){return serviceReplyReceipt.parse((await as(n,'select public.reply_service_request_once($1,$2,$3,$4) receipt',[ticket,key,body,status],aal)).receipt);}
const count=async(ticket:string)=>(await db.query<{n:number}>('select count(*)::int n from public.service_request_messages where request_id=$1',[ticket])).rows[0].n;
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await applyMigrationsThrough(db,36);await db.exec(`insert into auth.users(id) select ('a0000000-0000-4000-8000-00000000000'||n)::uuid from generate_series(1,6)n;insert into public.staff_members(user_id,role) values('${user(1)}','admin'),('${user(2)}','operator'),('${user(3)}','operator'),('${user(6)}','operator');insert into public.staff_unit_roles(user_id,unit_code,role) values('${user(2)}','zhidian_cn','finance_preparer'),('${user(3)}','zhidian_cn','finance_reviewer'),('${user(6)}','kbjm_ca','ad_operations');insert into public.organizations(id,name) values('${org}','FICTIONAL REPLY A'),('${other}','FICTIONAL REPLY B');`);
 for(const [n,company] of [[4,org],[5,other]] as const){await as(1,"select public.set_client_access($1,$2,'grant_viewer')",[company,user(n)]);await as(1,"select public.set_crm_finance_access($1,$2,'viewer')",[company,user(n)]);}
 legacy=await create();await as(4,"select public.reply_service_request($1,'FICTIONAL legacy reply','in_progress')",[legacy]);await db.exec(await readFile(new URL('../supabase/migrations/037_service_reply_receipts.sql',import.meta.url),'utf8'));
},30000);
afterAll(async()=>{await db?.close();});
it('upgrades existing messages without changing them and keeps the legacy RPC compatible',async()=>{
 expect(await count(legacy)).toBe(2);expect((await db.query('select count(*)::int n from public.service_request_messages where request_id=$1 and reply_request_key is not null',[legacy])).rows[0]).toEqual({n:0});await as(4,"select public.reply_service_request($1,'FICTIONAL compatible reply','in_progress')",[legacy]);expect(await count(legacy)).toBe(3);
});
it('returns the original receipt on retries without duplicate messages, audit events or stale status replay',async()=>{
 const t=await create(),key=randomUUID(),first=await reply(4,t,key,'FICTIONAL client reply','resolved');expect(first).toMatchObject({request_id:t,status:'open',replayed:false});const retry=await reply(4,t,key,'FICTIONAL client reply','in_progress');expect(retry).toEqual({...first,replayed:true});expect(await count(t)).toBe(2);
 expect((await db.query('select count(*)::int n from public.audit_events where entity_id=$1 and operation=$2',[t,'UPDATE'])).rows[0]).toEqual({n:1});
 const resolved=await reply(2,t,randomUUID(),'FICTIONAL staff answer','resolved');expect(resolved.status).toBe('resolved');await reply(4,t,key,'FICTIONAL client reply','open');expect((await db.query('select status from public.service_requests where id=$1',[t])).rows[0]).toEqual({status:'resolved'});
 expect((await reply(4,t,randomUUID(),'FICTIONAL follow-up','resolved')).status).toBe('open');expect(await count(t)).toBe(4);
});
it('rejects changed content/status or another thread under the same actor key',async()=>{
 const t=await create(),another=await create(),key=randomUUID();await reply(2,t,key,'FICTIONAL answer','resolved');await expect(reply(2,t,key,'CHANGED answer','resolved')).rejects.toThrow(/Reply key conflict/);await expect(reply(2,t,key,'FICTIONAL answer','open')).rejects.toThrow(/Reply key conflict/);await expect(reply(2,another,key,'FICTIONAL answer','resolved')).rejects.toThrow(/Reply key conflict/);expect(await count(t)).toBe(2);expect(await count(another)).toBe(1);
});
it('checks current company/finance access and staff MFA before returning any old receipt',async()=>{
 const t=await create(),key=randomUUID();await reply(4,t,key);await expect(reply(5,t,key)).rejects.toThrow(/Forbidden/);await expect(reply(6,t,key)).rejects.toThrow(/Forbidden/);const staffKey=randomUUID();await reply(2,t,staffKey);await expect(reply(2,t,staffKey,'FICTIONAL reply','in_progress','aal1')).rejects.toThrow(/Forbidden/);
 await as(1,"select public.set_crm_finance_access($1,$2,'none')",[org,user(4)]);await expect(reply(4,t,key)).rejects.toThrow(/Forbidden/);await as(1,"select public.set_crm_finance_access($1,$2,'viewer')",[org,user(4)]);
});
it('allows an existing retry at the message cap but refuses a new message',async()=>{
 const t=await create(),key=randomUUID();await reply(4,t,key);await db.query("insert into public.service_request_messages(request_id,body,author_id,author_role) select $1,'FICTIONAL cap message',$2,'client' from generate_series(1,198)",[t,user(4)]);expect(await count(t)).toBe(200);expect((await reply(4,t,key)).replayed).toBe(true);await expect(reply(4,t,randomUUID())).rejects.toThrow(/Message limit/);expect(await count(t)).toBe(200);
});
it('keeps receipt metadata private and immutable, with no financial side effects',async()=>{
 const t=await create(),receipt=await reply(4,t,randomUUID());await expect(as(4,'select reply_request_key from public.service_request_messages where id=$1',[receipt.message_id])).rejects.toThrow(/permission denied/);await expect(db.query("update public.service_request_messages set body='CHANGED confirmed reply' where id=$1",[receipt.message_id])).rejects.toThrow(/immutable/);await expect(db.query('delete from public.service_request_messages where id=$1',[receipt.message_id])).rejects.toThrow(/immutable/);
 expect((await db.query('select count(*)::int n from public.wallet_entries')).rows[0]).toEqual({n:0});expect((await db.query('select count(*)::int n from public.monthly_client_statements')).rows[0]).toEqual({n:0});
});
it('applies the same conversation SELECT scope used by downloads to clients, finance staff and revoked sessions',async()=>{
 const t=await create();const read=async(n:number,aal='aal2')=>as(n,'select (select count(*)::int from public.service_requests where id=$1) requests,(select count(*)::int from public.service_request_messages where request_id=$1) messages',[t],aal);
 expect(await read(4)).toEqual({requests:1,messages:1});expect(await read(2)).toEqual({requests:1,messages:1});
 expect(await read(5)).toEqual({requests:0,messages:0});expect(await read(6)).toEqual({requests:0,messages:0});expect(await read(2,'aal1')).toEqual({requests:0,messages:0});
 await as(1,"select public.set_crm_finance_access($1,$2,'none')",[org,user(4)]);expect(await read(4)).toEqual({requests:0,messages:0});await as(1,"select public.set_crm_finance_access($1,$2,'viewer')",[org,user(4)]);
});
