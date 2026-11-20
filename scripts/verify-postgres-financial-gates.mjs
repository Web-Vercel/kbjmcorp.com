// True multi-connection local PostgreSQL drill; isolated container, no network or hosted writes.
import {spawn} from 'node:child_process';
import {randomUUID,randomBytes,createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const container='kbjm-financial-gates-'+randomUUID().slice(0,8),reportDir=process.env.GATES_REPORT_DIR||'/tmp/kbjm-postgres-gates';
const dockerEnv={...process.env};for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dockerEnv[key];
const dargs=['--host=unix:///var/run/docker.sock'];
async function docker(args,input,binary=false){return new Promise((ok,no)=>{const p=spawn('docker',[...dargs,...args],{env:dockerEnv,stdio:['pipe','pipe','pipe']});const out=[],err=[];p.stdout.on('data',x=>out.push(x));p.stderr.on('data',x=>err.push(x));p.on('error',no);p.on('close',code=>code===0?ok(binary?Buffer.concat(out):Buffer.concat(out).toString()):no(Error(Buffer.concat(err).toString().slice(-2400))));p.stdin.end(input);});}
const sql=(body,db='drill')=>docker(['exec','-i',container,'psql','-X','-v','ON_ERROR_STOP=1','-qAt','-U','postgres','-d',db],body);
const uid=n=>`f0000000-0000-4000-8000-${String(n).padStart(12,'0')}`,sessions=new Map();
const as=(n,body,aal='aal2')=>sql(`begin;set local statement_timeout='12s';set local role authenticated;do $$begin perform set_config('request.jwt.claim.sub','${uid(n)}',true);perform set_config('request.jwt.claims','${JSON.stringify({aal,session_id:sessions.get(n)})}',true);end$$;${body};commit;`);
const j=async promise=>JSON.parse((await promise).trim().split('\n').at(-1));
const action=(n,kind,data,request=randomUUID(),tail='')=>j(as(n,`select public.partner_finance_action('${kind}','${request}',${quote(JSON.stringify({note:'FICTIONAL LOCAL DRILL - NO BANK TRANSFER',...data}))}::jsonb)${tail}`));
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const balance=async()=>Number((await sql(`select sum(amount_minor) from public.wallet_entries where wallet_id='${uid(201)}'`)).trim());
const held=async()=>Number((await sql(`select public.refund_holds('${uid(201)}')`)).trim());
const evidence=[];let created=false;
try{
 await docker(['run','-d','--name',container,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17']);created=true;
 let ready=false;for(let i=0;i<60;i++){try{const logs=await docker(['logs',container]);if(!logs.includes('PostgreSQL init process complete'))throw Error('initializing');await docker(['exec',container,'psql','-U','postgres','-Atc','select 1']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}assert(ready);
 await sql('create database drill','postgres');
 await sql(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
 create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid,created_at timestamptz default clock_timestamp());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 create schema storage;grant usage on schema storage to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,unique(bucket_id,name));alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);
 const dir=new URL('../supabase/migrations/',import.meta.url),migrations=(await readdir(dir)).filter(x=>/^\d{3}_.*\.sql$/.test(x)).sort();for(const name of migrations){
  if(process.env.GATES_UPGRADE_FROM_040==='1'&&Number(name.slice(0,3))>40)continue;
  const source=await readFile(new URL(name,dir),'utf8');await sql(process.env.GATES_UPGRADE_BASELINE_BOOTSTRAP==='1'?source.replace(/[ \t]+$/gm,''):source);
 }
 if(process.env.GATES_UPGRADE_FROM_040==='1'){
  await sql(`insert into auth.users(id,email,email_confirmed_at) values('${uid(990)}','preserve@example.invalid',now());insert into public.staff_members(user_id,role) values('${uid(990)}','admin');insert into public.organizations(id,name) values('${uid(991)}','Upgrade preservation fixture');insert into public.client_wallets(id,organization_id,currency) values('${uid(992)}','${uid(991)}','CNY');insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values('${uid(992)}','${uid(991)}','CNY','topup',12345,'Preserved original history','UPGRADE-PRESERVATION');`);
  const preserved=()=>sql(`select json_build_object('user',(select json_agg(x) from (select * from auth.users where id='${uid(990)}')x),'staff',(select json_agg(x) from (select * from public.staff_members where user_id='${uid(990)}')x),'wallet',(select json_agg(x) from (select * from public.client_wallets where id='${uid(992)}')x),'ledger',(select json_agg(x) from (select * from public.wallet_entries where wallet_id='${uid(992)}')x))`);
  const before=JSON.parse((await preserved()).trim()),readiness=await readFile(new URL('../supabase/upgrades/production_040_readiness.sql',import.meta.url),'utf8'),upgrade=await readFile(new URL('../supabase/upgrades/production_040_to_053.sql',import.meta.url),'utf8');
  await sql(readiness);
  await assert.rejects(sql(upgrade.replace('-- BEGIN 053_live_client_company_profiles.sql','select 1/0;\n-- BEGIN 053_live_client_company_profiles.sql')),/division by zero/);
  assert.equal((await sql("select to_regclass('public.balance_refunds') is null")).trim(),'t');
  assert.deepEqual(JSON.parse((await preserved()).trim()),before);await sql(upgrade);assert.deepEqual(JSON.parse((await preserved()).trim()),before);
  await assert.rejects(sql(upgrade),/already or partially applied/);assert.deepEqual(JSON.parse((await preserved()).trim()),before);
  evidence.push('040->053 bundle: native PostgreSQL baseline fingerprints verified, late failure rolls back, original auth/admin/wallet/ledger preserved, replay rejected; subsequent financial and restore drills use the upgraded schema');
 }

 for(let n=1;n<=5;n++){await sql(`insert into auth.users(id,email,email_confirmed_at) values('${uid(n)}','fixture${n}@example.invalid',now());`);sessions.set(n,(await sql(`insert into auth.sessions(user_id) values('${uid(n)}') returning id`)).trim());}
 await sql(`insert into public.staff_members(user_id,role) values('${uid(1)}','admin'),('${uid(2)}','operator'),('${uid(3)}','operator');insert into public.organizations(id,name) values('${uid(101)}','FICTIONAL CONCURRENCY A'),('${uid(102)}','FICTIONAL CONCURRENCY B');`);
 await as(1,`select public.assign_operating_role('${uid(2)}','zhidian_cn','finance_preparer',true);select public.assign_operating_role('${uid(3)}','zhidian_cn','finance_reviewer',true);select public.set_live_account_access('${uid(4)}','${uid(101)}','client','FICTIONAL A','fixture4@example.invalid',true,0,'FICTIONAL GRANT');select public.set_live_account_access('${uid(5)}','${uid(102)}','client','FICTIONAL B','fixture5@example.invalid',true,0,'FICTIONAL GRANT')`);
 // Scoped identity grants invalidate earlier sessions. Create fresh client sessions.
 for(const n of [4,5])sessions.set(n,(await sql(`insert into auth.sessions(user_id) values('${uid(n)}') returning id`)).trim());
 await sql(`insert into public.client_wallets(id,organization_id,currency) values('${uid(201)}','${uid(101)}','CNY'),('${uid(202)}','${uid(102)}','CNY');insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values('${uid(201)}','${uid(101)}','CNY','topup',10000,'FICTIONAL CREDIT','LOCAL-OPENING'),('${uid(202)}','${uid(102)}','CNY','topup',777,'FICTIONAL OTHER','LOCAL-OTHER');`);
 const policy=(await action(1,'refund_policy',{walletId:uid(201),mode:'fixed',value:100})).id;
 const input={walletId:uid(201),policyId:policy,amountMinor:'7000',accepted:true};
 const request=randomUUID(),secondRequest=randomUUID();const first=action(4,'refund_request',input,request,`;select pg_sleep(2)`);await new Promise(r=>setTimeout(r,150));
 const competing=action(4,'refund_request',input,secondRequest);await new Promise(r=>setTimeout(r,200));const observedLockWait=Number((await sql("select count(*) from pg_stat_activity where datname='drill' and wait_event_type='Lock'")).trim());assert(observedLockWait>0,'must observe a real overlapping transaction blocked on a lock');const results=await Promise.allSettled([first,competing]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);assert.equal(await held(),7000);assert.equal(await balance(),10000);
 const refund=(await j(sql(`select json_build_object('id',id) from public.balance_refunds where status='requested'`))).id;
 evidence.push('two concurrent 7000 requests against 10000: one succeeds; held7000, ledger10000');
 const winnerRequest=results[0].status==='fulfilled'?request:secondRequest;const duplicate=await Promise.all([action(4,'refund_request',input,winnerRequest),action(4,'refund_request',input,winnerRequest)]);assert.equal(duplicate[0].id,refund);assert.equal(duplicate[1].id,refund);assert.equal(await held(),7000);
 await assert.rejects(action(5,'refund_cancel',{id:refund}),/Cannot cancel|access|Forbidden/i);
 await action(2,'refund_prepare',{id:refund});await assert.rejects(action(2,'refund_review',{id:refund,decision:'approve'}),/Independent/);await action(3,'refund_review',{id:refund,decision:'approve'});await action(1,'refund_approve',{id:refund});
 await assert.rejects(action(2,'payment_record',{id:refund,kind:'refund',amountMinor:'7000',bankReference:'LOCAL-WRONG',payeeReference:'FICTIONAL ONLY',paidOn:'2026-01-01'}),/mismatch/);
 assert.equal(await balance(),10000);
 const pay=(await action(2,'payment_record',{id:refund,kind:'refund',amountMinor:'6900',bankReference:'LOCAL-NO-TRANSFER',payeeReference:'FICTIONAL ONLY',paidOn:'2026-01-01'})).id;
 await assert.rejects(action(2,'payment_verify',{id:pay,decision:'approve'}),/Independent/);assert.equal(await balance(),10000);
 const verificationRequest=randomUUID();const verified=await Promise.all([action(3,'payment_verify',{id:pay,decision:'approve'},verificationRequest),action(3,'payment_verify',{id:pay,decision:'approve'},verificationRequest)]);assert.equal(verified[0].id,verified[1].id);assert.equal(await balance(),3000);assert.equal(await held(),0);
 assert.equal((await sql(`select count(*) from public.wallet_entries where source_reference='balance-refund:${refund}'`)).trim(),'2');
 assert.equal((await sql(`select sum(amount_minor) from public.wallet_entries where wallet_id='${uid(202)}'`)).trim(),'777');
 evidence.push('complete independently reviewed refund: wrong amount and self-verification rejected; concurrent same-request verification debits net6900+fee100 exactly once; unrelated wallet777 unchanged');
 // Competing publication/refund on the same wallet with independently approved committed costs.
 const account=randomUUID(),packet=randomUUID(),quoteId=randomUUID();
 await sql(`insert into public.ad_accounts(id,organization_id,platform,external_id,label) values('${account}','${uid(101)}','openai_ads','adacct_${randomUUID()}','FICTIONAL CONCURRENCY ACCOUNT');insert into public.ops_source_packets(id,organization_id,ad_account_id,period,version,source_currency,source_timezone,source_language,source_amount_minor,source_reference,submitted_by) values('${packet}','${uid(101)}','${account}','2026-09-01',1,'CAD','UTC','zh',100,'FICTIONAL-LOCAL-SOURCE','${uid(1)}')`);
 await as(1,`select public.register_ops_fx_reference('${quoteId}','4.65332713',(now() at time zone 'Asia/Shanghai')::date,'Bank of Canada')`);
 const draft=(await j(as(1,`select json_build_object('id',public.prepare_ops_reconciliation('${packet}','${quoteId}',0,''))`))).id;
 await as(3,`select public.review_ops_reconciliation('${draft}','approved','FICTIONAL independent review')`);
 const publicationSummary='FICTIONAL LOCAL DRILL - NOT PAYABLE';
 const publish=()=>j(as(1,`select json_build_object('id',public.publish_manual_statement('${draft}',${quote(publicationSummary)}))`));
 const overlap=await Promise.all([publish(),action(4,'refund_request',{...input,amountMinor:'2535'}),publish()]);
 assert.equal(overlap[0].id,overlap[2].id);assert.equal(await balance(),2535);assert.equal(await held(),2535);
 await assert.rejects(action(4,'refund_request',{...input,amountMinor:'200'}),/Insufficient/);
 const statement=overlap[0].id;assert.equal((await sql(`select count(*) from public.wallet_entries where source_reference='monthly-statement:${statement}'`)).trim(),'1');
 await assert.rejects(as(1,`select public.publish_manual_statement('${draft}','Changed summary')`),/immutable/);
 await action(4,'refund_cancel',{id:overlap[1].id});assert.equal(await held(),0);
 evidence.push('concurrent duplicate publication and refund respect approved costs: publication465 once, balance2535 and hold2535; further refund rejected, cancellation releases hold');
 // Rejection is final in the current workflow: revise by creating a new linked-context request, never edit financial history.
 const rejected=(await action(4,'refund_request',{...input,amountMinor:'1000'})).id;
 await action(2,'refund_reject',{id:rejected,note:'FICTIONAL RETURN: missing basis'});assert.equal(await held(),0);
 const resubmitted=(await action(4,'refund_request',{...input,amountMinor:'1000',note:'FICTIONAL corrected request; prior '+rejected})).id;assert.notEqual(rejected,resubmitted);assert.equal(await held(),1000);
 assert.equal((await sql(`select status from public.balance_refunds where id='${rejected}'`)).trim(),'rejected');await action(4,'refund_cancel',{id:resubmitted});assert.equal(await held(),0);
 evidence.push('rejected refund remains immutable history; corrected request receives a new id and hold, cancellation releases it');
 await sql(await readFile(new URL('../supabase/verification/production_financial_preflight.sql',import.meta.url),'utf8'));
 evidence.push('production metadata preflight SQL executes read-only against latest schema; not executed against hosted Production');
 // Native PostgreSQL dump/restore into a new database. Roles remain on this isolated server.
 const inventory=db=>sql(`select json_build_object('ledger',(select json_agg(x order by wallet_id) from (select wallet_id,sum(amount_minor)::text balance,count(*)::int entries from public.wallet_entries group by wallet_id)x),'rls',(select json_agg(x order by relname) from (select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')x),'policies',(select json_agg(x order by tablename,policyname) from (select tablename,policyname,cmd,roles,qual,with_check from pg_policies where schemaname='public')x),'functions',(select md5(string_agg(pg_get_functiondef(p.oid),E'\\n' order by p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'))`,db);
 const beforeRestore=JSON.parse((await inventory('drill')).trim());
 const dump=await docker(['exec',container,'pg_dump','-U','postgres','-Fc','drill'],undefined,true);
 const key=randomBytes(32),nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce),encrypted=Buffer.concat([cipher.update(dump),cipher.final()]),tag=cipher.getAuthTag();
 const decrypt=buffer=>{const dec=createDecipheriv('aes-256-gcm',key,nonce);dec.setAuthTag(tag);return Buffer.concat([dec.update(buffer),dec.final()]);};const tampered=Buffer.from(encrypted);tampered[0]^=1;assert.throws(()=>decrypt(tampered));
 await sql('create database restored','postgres');await docker(['exec','-i',container,'pg_restore','-U','postgres','--exit-on-error','-d','restored'],decrypt(encrypted));
 const afterRestore=JSON.parse((await inventory('restored')).trim());
 // Function OIDs can change during restore; compare function definitions by signature instead.
 delete beforeRestore.functions;delete afterRestore.functions;assert.deepEqual(afterRestore,beforeRestore);
 const functionInventory=db=>sql("select md5(string_agg(pg_get_functiondef(p.oid),E'\\n' order by p.proname,pg_get_function_identity_arguments(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'",db);
 assert.equal((await functionInventory('drill')).trim(),(await functionInventory('restored')).trim());
 await assert.rejects(sql('update public.wallet_entries set amount_minor=1','restored'),/immutable|Posted money/i);
 const restoredClient=await sql(`begin;set local role authenticated;do $$begin perform set_config('request.jwt.claim.sub','${uid(5)}',true);perform set_config('request.jwt.claims','${JSON.stringify({aal:'aal1',session_id:sessions.get(5)})}',true);end$$;select sum(amount_minor) from public.wallet_entries;rollback;`,'restored');assert.equal(restoredClient.trim(),'777');
 assert.equal(await balance(),2535);await mkdir(reportDir,{recursive:true});await writeFile(reportDir+'/fictional-native-backup.enc',Buffer.concat([nonce,tag,encrypted]),{mode:0o600});
 evidence.push('native pg_dump encrypted with AES-256-GCM, tamper rejected, pg_restore to separate database; ledger/RLS/policies/functions match, source preserved, client isolation and immutable ledger rechecked');
 const nativeBackupSha256=createHash('sha256').update(encrypted).digest('hex');
 await mkdir(reportDir,{recursive:true});const report={passed:true,localOnly:true,postgres:'17',migrations:migrations.length,trueConcurrentConnections:true,baselineInstallFormat:process.env.GATES_UPGRADE_BASELINE_BOOTSTRAP==='1'?'historical-bootstrap':'raw-migrations',observedLockWait,nativeBackupSha256,restoredIntoSeparateDatabase:true,encryptionKeyPersisted:false,artifactPurpose:'ephemeral local drill',network:'none',financialWrites:'fictional isolated container only',evidence};await writeFile(reportDir+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{if(created)await docker(['rm','-fv',container]);}
