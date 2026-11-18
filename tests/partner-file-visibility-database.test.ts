import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;const id=(n:number)=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function as(n:number,sql:string,args:unknown[]=[]){await db.exec(`begin;set local role authenticated;select set_config('test.uid','${id(n)}',true);`);try{const r=await db.query<any>(sql,args);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
beforeAll(async()=>{db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select current_setting('test.uid')::uuid$$;grant usage on schema auth to authenticated;
 create table public.partner_files(id uuid primary key,object_path text,owner_id uuid);create function public.lock_posted_money() returns trigger language plpgsql as $$begin raise exception 'Immutable';end$$;
 create function public.has_staff_access(text[]) returns boolean language sql as $$select auth.uid()='${id(1)}'::uuid$$;
 create function public.require_partner_agent(boolean) returns boolean language plpgsql as $$begin if auth.uid() not in ('${id(2)}'::uuid,'${id(3)}'::uuid) then raise exception 'Forbidden';end if;return true;end$$;
 create function public.can_partner_file_path(text) returns boolean language sql security definer as $$select exists(select 1 from public.partner_files where object_path=$1 and (owner_id=auth.uid() or public.has_staff_access(array['admin'])))$$;
 create function public.read_partner_file(uuid) returns jsonb language plpgsql security definer as $$begin if not exists(select 1 from public.partner_files where id=$1 and public.can_partner_file_path(object_path)) then raise exception 'Forbidden';end if;return '{}'::jsonb;end$$;
 insert into auth.users values('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}');insert into public.partner_files values('${id(10)}','file-a','${id(2)}'),('${id(11)}','file-b','${id(3)}');`);await db.exec(await readFile(new URL('../supabase/migrations/049_partner_file_visibility.sql',import.meta.url),'utf8'));});
afterAll(async()=>{await db.close();});
it('keeps removals auditable, scoped, immutable and replay-safe, then restores',async()=>{
 const args=[id(20),id(10),true,'mistake'];
 await expect(as(3,'select public.set_partner_file_visibility($1,$2,$3,$4)',args)).rejects.toThrow('Forbidden');
 await expect(as(4,'select public.read_partner_file_visibility()')).rejects.toThrow('Forbidden');
 await as(2,'select public.set_partner_file_visibility($1,$2,$3,$4)',args);await as(2,'select public.set_partner_file_visibility($1,$2,$3,$4)',args);
 expect((await db.query<any>('select count(*)::int n from public.partner_file_visibility')).rows[0].n).toBe(1);
 expect((await as(2,'select public.read_partner_file_visibility() data'))[0].data).toEqual([{file_id:id(10),hidden:true,reason:'mistake'}]);
 expect((await as(3,'select public.read_partner_file_visibility() data'))[0].data).toEqual([]);
 await expect(as(2,'select public.set_partner_file_visibility($1,$2,$3,$4)',[id(20),id(10),false,'restore'])).rejects.toThrow('Request conflict');
 await expect(as(2,'delete from public.partner_file_visibility')).rejects.toThrow();await expect(db.exec('delete from public.partner_file_visibility')).rejects.toThrow('Immutable');
 await as(1,'select public.set_partner_file_visibility($1,$2,$3,$4)',[id(21),id(10),false,'restore']);expect((await as(2,'select public.read_partner_file_visibility() data'))[0].data[0].hidden).toBe(false);
 expect((await db.query<any>('select count(*)::int n from public.partner_files')).rows[0].n).toBe(2);
});
