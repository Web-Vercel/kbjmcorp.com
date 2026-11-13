import {applyMigrationsThrough} from './fixtures/migrations';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {afterAll,beforeAll,expect,it} from 'vitest';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await applyMigrationsThrough(db,17);
 await db.exec(await readFile(new URL('../supabase/migrations/018_agency_quote_snapshots.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/019_quote_revision_archive.sql',import.meta.url),'utf8'));
 await db.exec(`insert into auth.users(id) values('a0000000-0000-4000-8000-000000000001');insert into auth.users(id) values('a0000000-0000-4000-8000-000000000002'),('a0000000-0000-4000-8000-000000000003');insert into public.staff_members(user_id,role) values('a0000000-0000-4000-8000-000000000001','admin'),('a0000000-0000-4000-8000-000000000002','operator');insert into public.staff_unit_roles(user_id,unit_code,role) values('a0000000-0000-4000-8000-000000000002','zhidian_cn','finance_reviewer');insert into public.organizations(id,name) values('b0000000-0000-4000-8000-000000000001','FICTIONAL PRICING COMPANY');`);
},30000);
afterAll(async()=>{await db?.close();});


const org='b0000000-0000-4000-8000-000000000001';
const snapshot={calculationVersion:'two-agency-v1',status:'draft',rate:'5.2',finalMinor:'630000',note:'PRIVATE provider cost',costMinor:'10000'};
async function asUser(who:string,sql:string,args:unknown[]=[]){await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000${who}',true);select set_config('request.jwt.claims','{"aal":"aal2"}',true);`);try{const r=await db.query<Record<string,unknown>>(sql,args);await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}}
const save=(request='c0000000-0000-4000-8000-000000000001',value=snapshot)=>asUser('1',"select public.save_agency_quote_snapshot($1,'2026-11-01',$2,$3,$4) id",[org,request,'a'.repeat(64),JSON.stringify(value)]);

it('revises without overwriting, archives/restores with stale-write protection and keeps history',async()=>{
 const first=String((await save()).rows[0].id);
 const child=await asUser('1',"select public.save_agency_quote_revision($1,'2026-11-01','c0000000-0000-4000-8000-000000000002',$2,$3,$4) id",[org,'b'.repeat(64),JSON.stringify({...snapshot,finalMinor:'700000'}),first]);
 expect((await db.query('select revision from public.agency_quote_snapshots order by revision')).rows).toEqual([{revision:1},{revision:2}]);
 expect((await db.query('select parent_id from public.agency_quote_derivations where quote_id=$1',[child.rows[0].id])).rows).toEqual([{parent_id:first}]);
 const archive=(flag:boolean,rev:number)=>asUser('1',"select public.set_agency_quote_archived($1,$2,$3,'FICTIONAL lifecycle test') revision",[first,flag,rev]);
 expect((await archive(true,0)).rows).toEqual([{revision:1}]);expect((await archive(true,0)).rows).toEqual([{revision:1}]);
 const visible=await asUser('2','select public.list_agency_quotes($1,false) records',[org]);expect((visible.rows[0].records as unknown[])).toHaveLength(1);
 const all=await asUser('2','select public.list_agency_quotes($1,true) records',[org]);expect((all.rows[0].records as unknown[])).toHaveLength(2);expect(JSON.stringify(all.rows)).not.toContain('PRIVATE');
 await expect(archive(false,0)).rejects.toThrow(/state changed/);await archive(false,1);
 expect((await db.query("select private_snapshot->>'finalMinor' amount from public.agency_quote_snapshots where id=$1",[first])).rows).toEqual([{amount:'630000'}]);
 expect((await db.query("select count(*)::int n from public.audit_events where entity_type='quote_lifecycle'")).rows).toEqual([{n:2}]);expect((await db.query('select count(*)::int n from public.wallet_entries')).rows).toEqual([{n:0}]);
 await expect(asUser('2',"select public.set_agency_quote_archived($1,true,2,'Not authorized')",[first])).rejects.toThrow(/Forbidden/);
});
it('rejects a parent belonging to another company and retains immutable provenance',async()=>{
 const first=String((await save()).rows[0].id);await db.exec("insert into public.organizations(id,name) values('b0000000-0000-4000-8000-000000000002','OTHER FICTIONAL COMPANY')");
 await expect(asUser('1',"select public.save_agency_quote_revision('b0000000-0000-4000-8000-000000000002','2026-11-01','c0000000-0000-4000-8000-000000000003',$1,$2,$3)",['c'.repeat(64),JSON.stringify(snapshot),first])).rejects.toThrow(/Parent quote unavailable/);
 await expect(db.exec('delete from public.agency_quote_derivations')).rejects.toThrow(/immutable/);
});
