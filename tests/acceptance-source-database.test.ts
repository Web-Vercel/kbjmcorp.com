import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,expect,it} from 'vitest';
import {applyMigrationsThrough} from './fixtures/migrations';
import {acceptanceSourceCopy} from '@/lib/ads/acceptance-source';
import {acceptanceOriginal,testOrg,realOrg} from './fixtures/acceptance-source';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await applyMigrationsThrough(db,37);await db.exec(`insert into auth.users(id) values('a0000000-0000-4000-8000-000000000001');insert into public.staff_members(user_id,role) values('a0000000-0000-4000-8000-000000000001','admin');insert into public.organizations(id,name) values('${realOrg}','FICTIONAL OWNER CUSTOMER'),('${testOrg}','财务流程验收企业（虚构）');`);
},30000);
afterAll(async()=>{await db?.close();});
async function as(sql:string,args:unknown[]=[]){await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"aal":"aal2"}',true);`);try{const r=await db.query<Record<string,unknown>>(sql,args);await db.exec('commit');return r.rows[0];}catch(e){await db.exec('rollback');throw e;}}
it('preserves real-source ownership and money while a retried copy uses exactly one isolated account and handoff',async()=>{
 const originalId=String((await as("select public.save_ads_reporting_snapshot('d0000000-0000-4000-8000-000000000001',$1) id",[JSON.stringify(acceptanceOriginal)])).id);
 const originalBinding=String((await as("select public.bind_ads_reporting_account($1,$2,'FICTIONAL ORIGINAL OWNERSHIP') id",[originalId,realOrg])).id);
 const copy=acceptanceSourceCopy(acceptanceOriginal,originalId,testOrg,realOrg);
 let copyId='',copyBinding='',handoff='';
 for(let i=0;i<2;i++){
  const saved=String((await as('select public.save_ads_reporting_snapshot($1,$2) id',[copy.requestId,JSON.stringify(copy.report)])).id);
  const linked=String((await as('select public.bind_ads_reporting_account($1,$2,$3) id',[saved,testOrg,copy.reference])).id);
  const shared=String((await as('select public.share_ads_source_snapshot($1,$2,$3) id',[saved,linked,copy.reference])).id);
  if(i){expect(saved).toBe(copyId);expect(linked).toBe(copyBinding);expect(shared).toBe(handoff);}copyId=saved;copyBinding=linked;handoff=shared;
 }
 const original=await db.query<{organization_id:string;report:unknown}>('select b.organization_id,s.report from public.ads_reporting_bindings b join public.ads_reporting_snapshots s on s.account_id=b.account_id where b.id=$1',[originalBinding]);
 expect(original.rows[0].organization_id).toBe(realOrg);expect(original.rows[0].report).toEqual(acceptanceOriginal);
 expect((await db.query('select * from public.ads_reporting_bindings where organization_id=$1',[testOrg])).rows).toHaveLength(1);
 for(const table of ['wallet_entries','bank_receipts','monthly_client_statements','upstream_payment_records'])expect((await db.query<{n:number}>(`select count(*)::int n from public.${table}`)).rows[0].n).toBe(0);
});
