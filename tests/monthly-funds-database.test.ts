import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {applyMigrationsThrough} from './fixtures/migrations';
import {monthlyFundsSchema,monthlyFundsCsv} from '@/lib/billing/monthly-funds';
let db:PGlite;
const org='b0000000-0000-4000-8000-000000000001',wallet='b0000000-0000-4000-8000-000000000002',other='b0000000-0000-4000-8000-000000000003',user='a0000000-0000-4000-8000-000000000001';
beforeAll(async()=>{db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);await applyMigrationsThrough(db,34);
 await db.exec(`insert into auth.users(id) values('${user}'),('a0000000-0000-4000-8000-000000000002');insert into public.organizations(id,name) values('${org}','FICTIONAL FUNDS');insert into public.memberships(organization_id,user_id,role) values('${org}','${user}','owner');insert into public.finance_access values('${org}','${user}','viewer');insert into public.client_wallets(id,organization_id,currency) values('${wallet}','${org}','CNY'),('${other}','${org}','CAD');
 insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference,posted_at) values
 ('${wallet}','${org}','CNY','topup',100000,'FICTIONAL OPENING','FAKE-1','2024-03-01T07:59:59Z'),
 ('${wallet}','${org}','CNY','adjustment',2000,'FICTIONAL CREDIT','FAKE-2','2024-03-01T08:00:00Z'),
 ('${wallet}','${org}','CNY','service_fee',-500,'FICTIONAL DEBIT','FAKE-3','2024-04-01T06:59:59Z'),
 ('${wallet}','${org}','CNY','topup',3000,'FICTIONAL NEXT MONTH','FAKE-4','2024-04-01T07:00:00Z');`);
},30000);
afterAll(async()=>db?.close());
async function query(id:string,walletId=wallet,month='2024-03-01'){
 return db.transaction(async tx=>{await tx.exec(`set local role authenticated;select set_config('request.jwt.claim.sub','${id}',true);`);const r=await tx.query<{data:unknown}>('select public.get_client_monthly_funds($1,$2) data',[walletId,month]);return monthlyFundsSchema.parse(r.rows[0].data);});
}
it('reconciles all posted funds using Vancouver DST boundaries and carries zero-entry months forward',async()=>{
 const r=await query(user);expect(r.opening_minor).toBe('100000');expect(r.credits_minor).toBe('2000');expect(r.debits_minor).toBe('500');expect(r.closing_minor).toBe('101500');expect(r.entry_count).toBe(2);expect(monthlyFundsCsv(r,true)).toContain('1015.00');expect(JSON.stringify(r)).not.toContain('FAKE-');
 const empty=await query(user,wallet,'2024-05-01');expect(empty.entry_count).toBe(0);expect(empty.opening_minor).toBe('104500');expect(empty.closing_minor).toBe('104500');
 const cad=await query(user,other);expect(cad.closing_minor).toBe('0');expect(cad.currency).toBe('CAD');
});
it('denies ungranted users and invalid months',async()=>{
 await expect(query('a0000000-0000-4000-8000-000000000002')).rejects.toThrow(/Forbidden/);
 await expect(query(user,wallet,'2024-03-02')).rejects.toThrow(/ended calendar month/);
 await expect(query(user,wallet,'2999-01-01')).rejects.toThrow(/ended calendar month/);
});
it('keeps full totals beyond the detail limit and prevents incomplete CSV downloads',async()=>{
 await db.exec(`insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference,posted_at) select '${wallet}','${org}','CNY','adjustment',1,'FICTIONAL BULK ENTRY','FAKE-BULK-'||n,'2024-06-10T00:00:00Z'::timestamptz from generate_series(1,1001)n;`);
 const r=await query(user,wallet,'2024-06-01');expect(r.entry_count).toBe(1001);expect(r.entries).toHaveLength(1000);expect(r.credits_minor).toBe('1001');expect(r.closing_minor).toBe('105501');expect(r.complete).toBe(false);expect(()=>monthlyFundsCsv(r,true)).toThrow(/Incomplete/);
});

const finance='a0000000-0000-4000-8000-000000000003',source='a0000000-0000-4000-8000-000000000004',admin='a0000000-0000-4000-8000-000000000005';
async function staffCall(id:string,sql:string,args:unknown[]=[],aal='aal2'){
 return db.transaction(async tx=>{await tx.exec(`set local role authenticated;select set_config('request.jwt.claim.sub','${id}',true);select set_config('request.jwt.claims','{"aal":"${aal}"}',true);`);return tx.query<{data:unknown}>(sql,args);});
}
it('lets scoped MFA finance and admins read the exact client report, without personal client grants',async()=>{
 await db.exec(`insert into auth.users(id) values('${finance}'),('${source}'),('${admin}');insert into public.staff_members(user_id,role) values('${finance}','operator'),('${source}','operator'),('${admin}','admin');insert into public.staff_unit_roles(user_id,unit_code,role) values('${finance}','zhidian_cn','finance_reviewer'),('${source}','kbjm_ca','ad_operations');`);
 const client=await query(user);const result=await staffCall(finance,'select public.get_ops_monthly_funds($1,$2) data',[org,'2024-03-01']);const staff=monthlyFundsSchema.parse(result.rows[0].data);
 expect({...staff,generated_at:''}).toEqual({...client,generated_at:''});expect(staff.currency).toBe('CNY');expect(monthlyFundsCsv({...staff,generated_at:client.generated_at},true)).toEqual(monthlyFundsCsv(client,true));
 const owner=await staffCall(admin,'select public.get_ops_monthly_funds($1,$2) data',[org,'2024-03-01']);expect(monthlyFundsSchema.parse(owner.rows[0].data).closing_minor).toBe(client.closing_minor);
 await expect(query(finance)).rejects.toThrow(/Forbidden/);
});
it('does not allow clients, ad operators, missing MFA, unlinked units or direct builder calls to bypass scope',async()=>{
 await expect(staffCall(user,'select public.get_ops_monthly_funds($1,$2)',[org,'2024-03-01'])).rejects.toThrow(/Forbidden/);
 await expect(staffCall(source,'select public.get_ops_monthly_funds($1,$2)',[org,'2024-03-01'])).rejects.toThrow(/Forbidden/);
 await expect(staffCall(finance,'select public.get_ops_monthly_funds($1,$2)',[org,'2024-03-01'],'aal1')).rejects.toThrow(/Forbidden/);
 await expect(staffCall(user,'select public.build_monthly_funds_report($1,$2)',[wallet,'2024-03-01'])).rejects.toThrow(/permission denied/);
 await expect(staffCall(admin,'select public.build_monthly_funds_report($1,$2)',[wallet,'2024-03-01'])).rejects.toThrow(/permission denied/);
 await db.exec(`delete from public.client_operating_links where organization_id='${org}';`);
 await expect(staffCall(finance,'select public.get_ops_monthly_funds($1,$2)',[org,'2024-03-01'])).rejects.toThrow(/Forbidden/);
 await db.exec(`insert into public.client_operating_links(organization_id) values('${org}');`);
});
it('distinguishes missing CNY wallets from query failures, and leaves money and audit rows unchanged',async()=>{
 const emptyOrg='b0000000-0000-4000-8000-000000000004';await db.exec(`insert into public.organizations(id,name) values('${emptyOrg}','FICTIONAL NO WALLET');`);
 const before=(await db.query('select (select count(*) from public.wallet_entries) entries,(select count(*) from public.audit_events) audits')).rows;
 const result=await staffCall(finance,'select public.get_ops_monthly_funds($1,$2) data',[emptyOrg,'2024-03-01']);expect(result.rows[0].data).toBeNull();
 await staffCall(finance,'select public.get_ops_monthly_funds($1,$2)',[org,'2024-03-01']);
 expect((await db.query('select (select count(*) from public.wallet_entries) entries,(select count(*) from public.audit_events) audits')).rows).toEqual(before);
});
