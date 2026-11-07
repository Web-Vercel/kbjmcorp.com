import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {afterAll,beforeAll,expect,it} from 'vitest';
let db:PGlite;let probe:string;
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../supabase/bootstrap/new-test-project.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/017_private_fx.sql',import.meta.url),'utf8'));
 probe=await readFile(new URL('../supabase/tests/two-company-isolation.sql',import.meta.url),'utf8');
},30000);
afterAll(async()=>{await db?.close();});
it('keeps company isolation while withholding internal quotes and returning only statement validation',async()=>{
 const checks=`if (select count(*) from public.billing_fx_quotes)<>0 then raise exception 'FAIL internal quote leaked';end if;
 if not public.validate_client_statement('e5700000-0000-4000-8000-000000000501') then raise exception 'FAIL own report validation';end if;
 if public.validate_client_statement('e5700000-0000-4000-8000-000000000502') then raise exception 'FAIL foreign report validation';end if;`;
 const ownMarker="if not ((select count(*) from public.get_my_company_profiles() where id='e5700000-0000-4000-8000-000000000101')=1)";
 const staffChecks=`insert into public.staff_members(user_id,role) values('e5700000-0000-4000-8000-000000000005','operator');
 insert into public.staff_unit_roles(user_id,unit_code,role) values('e5700000-0000-4000-8000-000000000005','zhidian_cn','finance_preparer');
 set local role authenticated;
 select set_config('request.jwt.claim.sub','e5700000-0000-4000-8000-000000000005',true),set_config('request.jwt.claims','{"aal":"aal2"}',true);
 do $$ begin if (select count(*) from public.billing_fx_quotes)<>0 then raise exception 'FAIL finance quote leaked';end if;
 begin perform public.prepare_ops_reconciliation(null,null,0,'test');raise exception 'FAIL finance FX oracle';exception when insufficient_privilege then null;end;
 end $$;
 select set_config('request.jwt.claim.sub','e5700000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"aal":"aal2"}',true);
 do $$ begin if (select count(*) from public.billing_fx_quotes)<>1 then raise exception 'FAIL admin quote unavailable';end if;end $$;
 reset role;`;
 const p=probe.replace(ownMarker,checks+ownMarker).replace("select 'PASS' as isolation_result,",()=>staffChecks+"select 'PASS' as isolation_result,");
 expect((await db.exec(p)).some(r=>r.rows.some(row=>(row as {isolation_result?:string}).isolation_result==='PASS'))).toBe(true);
},30000);
