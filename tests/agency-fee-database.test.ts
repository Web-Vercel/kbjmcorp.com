import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {afterAll,beforeAll,expect,it} from 'vitest';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../supabase/bootstrap/new-test-project.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/016_agency_fee_drafts.sql',import.meta.url),'utf8'));
 await db.exec(`insert into auth.users(id) values('a0000000-0000-4000-8000-000000000001');insert into public.staff_members(user_id,role) values('a0000000-0000-4000-8000-000000000001','admin');insert into public.organizations(id,name) values('b0000000-0000-4000-8000-000000000001','FICTIONAL PRICING COMPANY');`);
},30000);
afterAll(async()=>{await db?.close();});

const org='b0000000-0000-4000-8000-000000000001';
async function save(authorized=true){await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','${authorized?'a0000000-0000-4000-8000-000000000001':''}',true);select set_config('request.jwt.claims','{"aal":"aal2"}',true);`);try{const r=await db.query("select public.save_agency_fee_draft($1,'kbjm_ca','2026-11-01','percentage','platform_ad_spend',1000,0,0,true,'FICTIONAL DRAFT') id",[org]);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
it('appends independently numbered immutable draft versions without financial postings',async()=>{await save();await save();expect((await db.query('select revision,currency from public.agency_fee_rule_drafts order by revision')).rows).toEqual([{revision:1,currency:'CAD'},{revision:2,currency:'CAD'}]);expect((await db.query('select count(*)::int n from public.wallet_entries')).rows).toEqual([{n:0}]);await expect(db.exec("update public.agency_fee_rule_drafts set basis_points=999")).rejects.toThrow(/immutable/);});
it('denies unauthorized drafting',async()=>{await expect(save(false)).rejects.toThrow(/Forbidden/);});
