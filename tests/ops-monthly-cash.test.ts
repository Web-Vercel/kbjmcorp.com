import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {afterAll,beforeAll,expect,it} from 'vitest';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../supabase/bootstrap/new-test-project.sql',import.meta.url),'utf8'));
 // Bootstrap already includes this migration; do not apply it twice.
 await db.exec(`insert into auth.users(id) values('a0000000-0000-4000-8000-000000000001');insert into public.staff_members(user_id,role) values('a0000000-0000-4000-8000-000000000001','admin');
 insert into public.organizations(id,name) values('b0000000-0000-4000-8000-000000000001','Fictional cash client');
 insert into public.client_wallets(id,organization_id,currency) values('c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','CNY');
 insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference,posted_at) select 'c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','CNY',kind,amount,'FICTIONAL',ref,ts::timestamptz from (values
 ('topup',100000,'opening','2009-12-31T15:59:59Z'),('topup',100001,'credit','2009-12-31T16:00:00Z'),('ad_spend',-30001,'ad-fee','2010-01-02T00:00:00Z'),('service_fee',-1000,'agency-fee','2010-01-02T00:00:00Z'),('refund',-2000,'refund','2010-01-02T00:00:00Z'),('adjustment',500,'adjustment','2010-01-31T15:59:59Z'),('topup',9999,'next-month','2010-01-31T16:00:00Z')) as fixtures(kind,amount,ref,ts);`);
},30000);
afterAll(async()=>{await db?.close();});

const org='b0000000-0000-4000-8000-000000000001';
async function monthly(month:string,authorized=true){
 await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','${authorized?'a0000000-0000-4000-8000-000000000001':''}',true);select set_config('request.jwt.claims','{"aal":"aal2"}',true);`);
 try{return (await db.query<{summary:Record<string,string>[]}>("select public.get_ops_monthly_cash($1,$2) as summary",[org,month])).rows[0].summary[0];}finally{await db.exec('rollback');}
}
it('uses exact signed ledger categories and Beijing month boundaries',async()=>{
 const s=await monthly('2010-01-01');
 expect(s).toMatchObject({opening_minor:'100000',topup_minor:'100001',ad_spend_minor:'30001',service_fee_minor:'1000',refund_minor:'2000',adjustment_minor:'500',closing_minor:'167500',entry_count:'5',timezone:'Asia/Shanghai'});
 const next=await monthly('2010-02-01');expect(next).toMatchObject({opening_minor:'167500',topup_minor:'9999',closing_minor:'177499',entry_count:'1'});
});
it('does not infer activity for an empty month',async()=>{expect(await monthly('2009-01-01')).toMatchObject({opening_minor:'0',closing_minor:'0',entry_count:'0'});});
it('rejects unauthorized, non-first-day and future queries',async()=>{await expect(monthly('2010-01-01',false)).rejects.toThrow(/Forbidden/);await expect(monthly('2010-01-02')).rejects.toThrow(/Valid current/);await expect(monthly('2999-01-01')).rejects.toThrow(/Valid current/);});
