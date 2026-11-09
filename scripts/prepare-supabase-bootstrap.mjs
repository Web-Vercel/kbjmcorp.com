import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export async function prepareBootstrap(){
 const directory=new URL('../supabase/migrations/',import.meta.url);
 const files=(await readdir(directory)).filter(f=>/^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort();
 if(!files.length)throw new Error('No migrations found');
 const migrations=[];const tables=new Set();
 for(const [index,file] of files.entries()){
  if(Number(file.slice(0,3))!==index+1)throw new Error('Migration sequence must be contiguous');
  const sql=await readFile(new URL(file,directory),'utf8');
  const begins=[...sql.matchAll(/^begin;\s*$/gmi)],commits=[...sql.matchAll(/^commit;\s*$/gmi)];
  if(begins.length!==1||commits.length!==1)throw new Error(`Expected one transaction per migration: ${file}`);
  for(const match of sql.matchAll(/create table public\.([a-z_]+)/gi))tables.add(match[1]);
  migrations.push({file,hash:createHash('sha256').update(sql).digest('hex'),sql:sql.replace(/[ \t]+$/gm,'').replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'').trim()});
 }
 const names=[...tables].sort().map(t=>`'${t}'`).join(',');
 const header=`-- GENERATED: npm run db:bundle. Do not hand-edit.\n-- NEW ISOLATED SUPABASE PROJECT ONLY. No customer data, Auth users or staff grants are seeded.\n-- Review the selected project's name/region in the dashboard before running.\n-- Run the entire file once in Supabase SQL Editor. Existing app tables cause a stop.\n-- This is one atomic transaction; it does not delete or replace existing business records.\n-- Do not run this after applying individual migrations or alongside Supabase CLI migrations.\n-- Included source SHA256:\n${migrations.map(m=>`-- ${m.file} ${m.hash}`).join('\n')}\n\nbegin;\nselect pg_advisory_xact_lock(187654321,130013);\ndo $bootstrap_guard$\nbegin\n if to_regclass('auth.users') is null or not exists(select 1 from pg_roles where rolname='authenticated') or not exists(select 1 from pg_roles where rolname='service_role') then\n  raise exception 'Supabase Auth schema and roles required; nothing was initialized';\n end if;\n if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in (${names})) then\n  raise exception 'Existing application objects detected. Stop and inspect migration history; do not overwrite';\n end if;\nend;\n$bootstrap_guard$;\n`;
 return `${header}\n${migrations.map(m=>`-- START ${m.file}\n${m.sql}\n-- END ${m.file}`).join('\n\n')}\n\n-- Refresh the Data API schema only after the full transaction succeeds.\nnotify pgrst, 'reload schema';\ncommit;\n`;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const expected=await prepareBootstrap();const target=new URL('../supabase/bootstrap/new-test-project.sql',import.meta.url);
 if(process.argv.includes('--check')){
  if(await readFile(target,'utf8')!==expected)throw new Error('Bootstrap is stale; run npm run db:bundle');
  console.log('Bootstrap matches all source migrations.');
 }else{await writeFile(target,expected);console.log('Prepared supabase/bootstrap/new-test-project.sql; no database connection or write was performed.');}
}
