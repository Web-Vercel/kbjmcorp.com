import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {beforeAll,afterAll,expect,it} from 'vitest';
import {applyMigrationsThrough} from './fixtures/migrations';
import {fixturePrelude} from '../scripts/prepare-production-upgrade.mjs';
let db:PGlite,upgrade:string,readiness:string;
const uid='c1000000-0000-4000-8000-000000000001',org='c1000000-0000-4000-8000-000000000002',wallet='c1000000-0000-4000-8000-000000000003';
const original=()=>db.query('select id,organization_id,amount_minor,description from public.wallet_entries order by id');
beforeAll(async()=>{db=new PGlite();await db.exec(fixturePrelude);await applyMigrationsThrough(db,40);upgrade=await readFile(new URL('../supabase/upgrades/production_040_to_053.sql',import.meta.url),'utf8');readiness=await readFile(new URL('../supabase/upgrades/production_040_readiness.sql',import.meta.url),'utf8');await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'upgrade@example.invalid',now())",[uid]);await db.query("insert into public.staff_members(user_id,role) values($1,'admin')",[uid]);await db.query("insert into public.organizations(id,name) values($1,'Upgrade preservation fixture')",[org]);await db.query("insert into public.client_wallets(id,organization_id,currency) values($1,$2,'CNY')",[wallet,org]);await db.query("insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values($1,$2,'CNY','topup',12345,'Upgrade preservation credit','UPGRADE-ORIGINAL')",[wallet,org]);},30000);
afterAll(async()=>{await db?.close();});
it('validates 040 without applying an upgrade and refuses baseline drift',async()=>{
 await db.exec(readiness);expect((await db.query<{obj:string|null}>("select to_regclass('public.balance_refunds') obj")).rows[0].obj).toBeNull();
 await db.exec('alter table public.organizations add column unexpected_drift text');await expect(db.exec(upgrade)).rejects.toThrow(/Baseline table columns differ/);await db.exec('rollback;alter table public.organizations drop column unexpected_drift');
});
it('rejects a partial installation before applying any migration',async()=>{
 await db.exec('create table public.balance_refunds(partial_marker integer)');await expect(db.exec(upgrade)).rejects.toThrow(/already or partially applied/);await db.exec('rollback;drop table public.balance_refunds');
});
it('rolls back all earlier changes if a late migration fails',async()=>{
 const before=(await original()).rows;
 await expect(db.exec(upgrade.replace('-- BEGIN 053_live_client_company_profiles.sql','select 1/0;\n-- BEGIN 053_live_client_company_profiles.sql'))).rejects.toThrow();await db.exec('rollback');
 expect((await db.query<{obj:string|null}>("select to_regclass('public.balance_refunds') obj")).rows[0].obj).toBeNull();expect((await original()).rows).toEqual(before);
});
it('preserves existing identities, staff rights, wallet history and installs latest functions atomically',async()=>{
 const before=(await original()).rows;await db.exec(upgrade);expect((await original()).rows).toEqual(before);
 expect((await db.query('select user_id,role,active from public.staff_members')).rows).toEqual([{user_id:uid,role:'admin',active:true}]);
 expect((await db.query('select id,email from auth.users')).rows).toEqual([{id:uid,email:'upgrade@example.invalid'}]);
 for(const signature of ['public.get_client_project_scope()','public.publish_manual_statement(uuid,text)','public.partner_finance_action(text,uuid,jsonb)','public.account_credential_session_valid()'])expect((await db.query<{present:string|null}>('select to_regprocedure($1) present',[signature])).rows[0].present).not.toBeNull();
 await expect(db.exec("update public.wallet_entries set amount_minor=1")).rejects.toThrow(/immutable|Posted money/i);
 expect((await db.query("select public from storage.buckets where id='partner-documents'")).rows).toEqual([{public:false}]);
});
it('refuses replay before changes rather than reinstalling tables or duplicating records',async()=>{const before=(await original()).rows;await expect(db.exec(upgrade)).rejects.toThrow(/already or partially applied/);await db.exec('rollback');expect((await original()).rows).toEqual(before);});
