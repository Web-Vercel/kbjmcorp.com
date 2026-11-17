import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {applyMigrationsThrough} from './fixtures/migrations';
let db:PGlite;const uid=(n:number)=>`d0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;const org=uid(100),other=uid(101);let wallet:string,otherWallet:string,agent:string,policy:string;let seq=500;const sessions=new Map<number,string>();
async function as(n:number,sql:string,args:unknown[]=[],aal='aal2'){await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','${uid(n)}',true);select set_config('request.jwt.claims','${JSON.stringify({aal,session_id:sessions.get(n)})}',true);`);try{const r=await db.query<any>(sql,args);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
async function command(n:number,action:string,data:Record<string,unknown>,request=uid(seq++)){try{return (await as(n,'select public.partner_finance_action($1,$2,$3) data',[action,request,{note:'FICTIONAL TEST EVIDENCE',...data}]))[0].data;}catch(e){throw Error(`${n} ${action}: ${(e as Error).message}`)}}
beforeAll(async()=>{db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid,created_at timestamptz default clock_timestamp());create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;create schema storage;grant usage on schema storage to authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,unique(bucket_id,name));alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);await applyMigrationsThrough(db,45);
 for(let n=1;n<=8;n++){await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid(n),`partner${n}@example.test`]);}
 await db.query("insert into public.staff_members(user_id,role) values($1,'admin'),($2,'operator'),($3,'operator')",[uid(1),uid(2),uid(3)]);
 await db.query("insert into public.organizations(id,name) values($1,'FICTIONAL ASSIGNED COMPANY'),($2,'PRIVATE OTHER COMPANY')",[org,other]);
 await as(1,"select public.assign_operating_role($1,'zhidian_cn','finance_preparer',true)",[uid(2)]);await as(1,"select public.assign_operating_role($1,'zhidian_cn','finance_reviewer',true)",[uid(3)]);
 wallet=(await as(1,'select public.open_crm_wallet($1) id',[org]))[0].id;otherWallet=(await as(1,'select public.open_crm_wallet($1) id',[other]))[0].id;
 for(const [n,role,target] of [[4,'client',org],[6,'client',other],[7,'investor',org],[8,'sales',org]] as const)await as(1,'select public.set_live_account_access($1,$2,$3,$4,$5,true,0,$6)',[uid(n),target,role,'FIXTURE '+role,`partner${n}@example.test`,'FICTIONAL GRANT']);
 agent=(await command(1,'agent_save',{userId:uid(5),email:'partner5@example.test',label:'FICTIONAL AGENT',revision:0,active:false})).id;
 await command(1,'agent_save',{userId:uid(5),email:'partner5@example.test',label:'FICTIONAL AGENT',revision:1,active:true});
 for(let n=1;n<=8;n++)sessions.set(n,(await db.query<any>('insert into auth.sessions(user_id) values($1) returning id',[uid(n)])).rows[0].id);
 await db.query("insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values($1,$2,'CNY','topup',100000,'FICTIONAL CREDIT','FIXTURE-CREDIT')",[wallet,org]);
 policy=(await command(1,'refund_policy',{walletId:wallet,mode:'percent',value:250})).id;
},30000);
afterAll(async()=>{await db?.close()});
it('separates agent identity and multi-client assignments from employee and client finance access',async()=>{
 const context=(await as(5,'select public.get_live_account_context() data'))[0].data;expect(context.role).toBe('agent');
 await expect(as(5,'select public.get_live_workspace()')).rejects.toThrow();await expect(as(5,'select public.read_refund_workspace()')).rejects.toThrow();
 await expect(db.query("insert into public.memberships(organization_id,user_id,role) values($1,$2,'owner')",[org,uid(5)])).rejects.toThrow(/legacy grants/);
 const input={agentId:agent,organizationId:org,from:'2026-01-01',until:'',rateBps:1000,basis:'service',waitDays:0};await command(1,'assignment_save',input);
 await expect(command(1,'assignment_save',{...input,from:'2026-10-01'})).rejects.toThrow(/already assigned/);
 await command(1,'assignment_save',{...input,organizationId:other});
 const view=(await as(5,"select public.read_partner_workspace('clients') data"))[0].data;expect(view.clients).toHaveLength(2);expect(view.organizations).toEqual([]);expect(view.statements).toEqual([]);expect(JSON.stringify(view)).not.toContain('partner4@');
 for(const n of [4,7,8])await expect(as(n,'select public.read_partner_workspace()')).rejects.toThrow();
});
it('confirms an agent lead and preserves the original referral separately from the review note',async()=>{
 const lead=await command(5,'lead_submit',{company:'FICTIONAL LEAD REVIEW',note:'ORIGINAL REFERRAL'});
 const request=uid(seq++),payload={id:lead.id,decision:'confirmed',organizationId:org,note:'INDEPENDENT ADMIN CONFIRMATION'};
 await expect(command(5,'lead_review',payload)).rejects.toThrow();await expect(command(2,'lead_review',payload)).rejects.toThrow();
 await command(1,'lead_review',payload,request);await command(1,'lead_review',payload,request);
 const row=(await db.query<any>('select status,note,review_note,organization_id from public.partner_leads where id=$1',[lead.id])).rows[0];expect(row).toMatchObject({status:'confirmed',note:'ORIGINAL REFERRAL',review_note:payload.note,organization_id:org});
 await expect(command(1,'lead_review',payload)).rejects.toThrow(/state changed/);const rejected=await command(5,'lead_submit',{company:'FICTIONAL RETURNED LEAD',note:'ORIGINAL RETURNED REFERRAL'});await command(1,'lead_review',{id:rejected.id,decision:'rejected',note:'FICTIONAL RETURN REASON'});expect((await db.query<any>('select status,note,review_note from public.partner_leads where id=$1',[rejected.id])).rows[0]).toMatchObject({status:'rejected',note:'ORIGINAL RETURNED REFERRAL',review_note:'FICTIONAL RETURN REASON'});
});
it('lets a password-only scoped client ask billing questions and read replies only in its company',async()=>{
 const request=(await as(4,"select public.create_service_request($1,'billing','FICTIONAL CLIENT QUESTION','FICTIONAL BILL EXPLANATION') id",[org],'aal1'))[0].id;
 await expect(as(4,"select public.create_service_request($1,'billing','FORGED QUESTION','FORGED OTHER COMPANY')",[other],'aal1')).rejects.toThrow();
 expect(await as(6,'select id from public.service_requests where id=$1',[request],'aal1')).toEqual([]);
 await as(3,"select public.reply_service_request($1,'FICTIONAL FINANCE REPLY','resolved')",[request]);
 const messages=await as(4,'select body from public.service_request_messages where request_id=$1 order by created_at',[request],'aal1');expect(messages.map((x:any)=>x.body)).toContain('FICTIONAL FINANCE REPLY');
 await as(4,"select public.reply_service_request($1,'FICTIONAL CLIENT FOLLOWUP','resolved')",[request],'aal1');expect((await as(4,'select status from public.service_requests where id=$1',[request],'aal1'))[0].status).toBe('open');
});
it('permits agent password sessions while keeping financial actions and other roles MFA protected',async()=>{
 const context=(await as(5,'select public.get_live_account_context() data',[],'aal1'))[0].data;expect(context.role).toBe('agent');
 expect((await as(5,"select public.read_partner_workspace('clients') data",[],'aal1'))[0].data.clients).toHaveLength(2);
 const lead=(await as(5,'select public.partner_finance_action($1,$2,$3) data',['lead_submit',uid(seq++),{company:'FICTIONAL PASSWORD LEAD',note:'FICTIONAL REFERRAL'}],'aal1'))[0].data;expect(lead.action).toBe('lead_submit');
 for(const n of [1,2,3,4,5])await expect(as(n,'select public.partner_finance_action($1,$2,$3)',['settlement_prepare',uid(seq++),{}],'aal1')).rejects.toThrow();
 expect((await as(4,'select public.get_live_account_context() data',[],'aal1'))[0].data.role).toBe('client');const passwordView=(await as(4,'select public.read_refund_workspace() data',[],'aal1'))[0].data;expect(passwordView.wallets).toHaveLength(1);expect(passwordView.wallets[0].organization_id).toBe(org);expect((await as(4,'select public.get_live_workspace() data',[],'aal1'))[0].data).toBeTruthy();await expect(as(6,'select public.partner_finance_action($1,$2,$3)',['refund_request',uid(seq++),{walletId:wallet,policyId:policy,amountMinor:'1000',accepted:true,note:'FICTIONAL CROSS COMPANY'}],'aal1')).rejects.toThrow();await expect(as(7,'select public.get_live_account_context()',[],'aal1')).rejects.toThrow();
});
it('snapshots percentage fees, reserves gross funds, rejects excess requests, and preserves unchanged retries',async()=>{
 const request=uid(seq++),data={walletId:wallet,policyId:policy,amountMinor:'40000',accepted:true};const r=await command(4,'refund_request',data,request);expect((await command(4,'refund_request',data,request)).id).toBe(r.id);
 await expect(command(4,'refund_request',{...data,amountMinor:'41000'},request)).rejects.toThrow(/conflict/);
 const view=(await as(4,'select public.read_refund_workspace() data'))[0].data;expect(view.wallets[0]).toMatchObject({held_minor:'40000',available_minor:'60000'});expect(view.refunds[0]).toMatchObject({gross_minor:'40000',fee_minor:'1000',net_minor:'39000'});
 await expect(command(4,'refund_request',{...data,amountMinor:'70000'})).rejects.toThrow(/balance/);
 await expect(command(6,'refund_request',data)).rejects.toThrow(/access/);await expect(command(8,'refund_request',data)).rejects.toThrow(/access/);
 await expect(db.query("insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values($1,$2,'CNY','ad_spend',-70000,'RESERVED DEBIT','FORGED-DEBIT')",[wallet,org])).rejects.toThrow(/reserved/);
 await db.exec('begin');try{await db.query("insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values($1,$2,'CNY','ad_spend',-20000,'FICTIONAL ATOMIC DEBIT','ATOMIC-1')",[wallet,org]);await expect(db.query("insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values($1,$2,'CNY','service_fee',-50000,'FICTIONAL ATOMIC DEBIT','ATOMIC-2')",[wallet,org])).rejects.toThrow(/reserved/);}finally{await db.exec('rollback');}
 await command(1,'refund_policy',{walletId:wallet,mode:'fixed',value:200});expect((await as(4,'select public.read_refund_workspace() data'))[0].data.refunds[0].fee_minor).toBe('1000');
 await expect(command(3,'refund_prepare',{id:r.id})).rejects.toThrow(/Preparation/);
 await command(2,'refund_prepare',{id:r.id});await expect(command(2,'refund_review',{id:r.id,decision:'approve'})).rejects.toThrow(/review/);await command(3,'refund_review',{id:r.id,decision:'approve'});
 await expect(command(2,'refund_approve',{id:r.id})).rejects.toThrow(/Administrator/);await expect(command(3,'refund_approve',{id:r.id})).rejects.toThrow(/Administrator/);await command(1,'refund_approve',{id:r.id});
 const payment=await command(2,'payment_record',{id:r.id,kind:'refund',amountMinor:'39000',bankReference:'FICTIONAL-REFUND-001',payeeReference:'Original payer verified, masked account 1234',paidOn:'2026-01-01'});
 expect((await as(4,'select public.read_refund_workspace() data'))[0].data.wallets[0].balance_minor).toBe('100000');
 await expect(command(2,'payment_verify',{id:payment.id,decision:'approve'})).rejects.toThrow(/Independent/);
 const verify=uid(seq++);await command(3,'payment_verify',{id:payment.id,decision:'approve'},verify);await command(3,'payment_verify',{id:payment.id,decision:'approve'},verify);
 const final=(await as(4,'select public.read_refund_workspace() data'))[0].data;expect(final.wallets[0]).toMatchObject({balance_minor:'60000',held_minor:'0'});expect(final.refunds[0].status).toBe('paid');
 expect((await db.query<any>("select count(*)::int n from public.wallet_entries where source_reference=$1",['balance-refund:'+r.id])).rows[0].n).toBe(2);
});
it('allows owner cancellation only before preparation and requires an agreed positive net refund, with client password login',async()=>{
 const view=(await as(4,'select public.read_refund_workspace() data'))[0].data,policyId=view.wallets[0].policy.id;
 const r=await command(4,'refund_request',{walletId:wallet,policyId,amountMinor:'10000',accepted:true});await expect(command(6,'refund_cancel',{id:r.id})).rejects.toThrow();await command(4,'refund_cancel',{id:r.id});
 expect((await as(4,'select public.read_refund_workspace() data'))[0].data.wallets[0].held_minor).toBe('0');
 await expect(command(4,'refund_request',{walletId:wallet,policyId,amountMinor:'100',accepted:true})).rejects.toThrow(/positive/);
 const passwordRefund=(await as(4,"select public.partner_finance_action('refund_request',$1,$2) data",[uid(seq++),{walletId:wallet,policyId,amountMinor:'10000',accepted:true,note:'FICTIONAL'}],'aal1'))[0].data;await as(4,"select public.partner_finance_action('refund_cancel',$1,$2)",[uid(seq++),{id:passwordRefund.id,note:'FICTIONAL CANCEL'}],'aal1');
});
let statement:string,commission:string,settlement:string;
it('earns only from receipt-backed published business and snapshots commission rules',async()=>{
 const ad=uid(700),binding=uid(701),snapshot=uid(702),quote=uid(703),draft=uid(704);statement=uid(705);
 await db.query("insert into public.ad_accounts(id,organization_id,platform,external_id,label) values($1,$2,'openai','PARTNER-FIXTURE','FICTIONAL AD ACCOUNT')",[ad,org]);
 await db.query("insert into public.ads_reporting_bindings(id,account_id,ad_account_id,organization_id,ownership_reference,created_by,updated_by) values($1,'adacct_PARTNER_FIXTURE',$2,$3,'FICTIONAL OWNERSHIP',$4,$4)",[binding,ad,org,uid(1)]);
 await db.query("insert into public.ads_reporting_snapshots(id,request_id,account_id,account_name,currency,timezone,since,until,check_status,daily_spend_micros,period_spend_micros,report,created_by) values($1,$1,'adacct_PARTNER_FIXTURE','FIXTURE','CAD','America/Vancouver','2026-01-01','2026-01-31','matched',10000000,10000000,'{}',$2)",[snapshot,uid(1)]);
 await db.query("insert into public.agency_quote_snapshots(id,organization_id,period,revision,request_id,request_fingerprint,private_snapshot,created_by) values($1,$2,'2026-01-01',1,$1,$3,'{}',$4)",[quote,org,'a'.repeat(64),uid(1)]);
 await db.query("insert into public.monthly_settlement_drafts(id,organization_id,binding_id,snapshot_id,quote_id,month,source_cad_minor,total_cny_minor,agreement_reference,note,prepared_by) values($1,$2,$3,$4,$5,'2026-01-01',1000,10000,'FICTIONAL AGREEMENT','FICTIONAL NOTE',$6)",[draft,org,binding,snapshot,quote,uid(2)]);
 await db.exec('begin');try{await db.query("insert into public.monthly_client_statements(id,draft_id,organization_id,binding_id,wallet_id,month,upstream_cny_minor,service_cny_minor,total_cny_minor,summary_zh,usage,published_by,published_at) values($1,$2,$3,$4,$5,'2026-01-01',6000,4000,10000,'FICTIONAL POSTED BILL','{}',$6,'2026-02-01')",[statement,draft,org,binding,wallet,uid(1)]);for(const [kind,amount] of [['ad_spend',-6000],['service_fee',-4000]])await db.query('insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values($1,$2,\'CNY\',$3,$4,\'FICTIONAL BILL\',$5)',[wallet,org,kind,amount,'monthly-statement:'+statement]);await db.exec('commit');}catch(e){await db.exec('rollback');throw e;}
 await expect(command(2,'commission_prepare',{statementId:statement})).rejects.toThrow(/receipt/);
 const account=uid(706);await db.query("insert into public.collection_accounts(id,legal_name,bank_name,account_number,verification_reference,created_by) values($1,'FICTIONAL LEGAL','FICTIONAL BANK','TESTONLY123','FICTIONAL ORIGINAL',$2)",[account,uid(1)]);
 await db.query("insert into public.bank_receipts(wallet_id,organization_id,collection_account_id,amount_minor,payer_name,bank_reference,booked_date,evidence_reference,status,prepared_by,reviewed_by,reviewed_at,review_note) values($1,$2,$3,100000,'FICTIONAL PAYER','TESTBANKSOURCE','2026-01-01','FICTIONAL ORIGINAL','credited',$4,$5,now(),'FICTIONAL VERIFIED')",[wallet,org,account,uid(2),uid(3)]);
 await expect(command(3,'commission_prepare',{statementId:statement})).rejects.toThrow(/Forbidden/);
 commission=(await command(2,'commission_prepare',{statementId:statement})).id;
 await expect(command(2,'commission_prepare',{statementId:statement})).rejects.toThrow();await expect(command(2,'commission_review',{id:commission,decision:'approve'})).rejects.toThrow(/Independent/);
 await command(3,'commission_review',{id:commission,decision:'approve'});
 const view=(await as(5,"select public.read_partner_workspace('commissions') data"))[0].data;expect(view.commissions[0]).toMatchObject({base_minor:'4000',amount_minor:'400',rate_bps:1000});expect(JSON.stringify(view)).not.toMatch(/TESTBANKSOURCE|private_snapshot|payer_name/);
});
it('settles a closed calendar month, separates approval from payment, and freezes settlement during refunds',async()=>{
 const policyId=(await as(4,'select public.read_refund_workspace() data'))[0].data.wallets[0].policy.id;
 const refund=await command(4,'refund_request',{walletId:wallet,policyId,amountMinor:'10000',accepted:true});
 await expect(command(2,'settlement_prepare',{agentId:agent,period:'2026-03-01'})).rejects.toThrow(/eligible/);
 await command(4,'refund_cancel',{id:refund.id});await expect(command(3,'settlement_prepare',{agentId:agent,period:'2026-03-01'})).rejects.toThrow();settlement=(await command(2,'settlement_prepare',{agentId:agent,period:'2026-03-01'})).id;
 const withdrawn=settlement;await command(1,'settlement_cancel',{id:withdrawn});expect((await db.query<any>('select status from public.partner_settlements where id=$1',[withdrawn])).rows[0].status).toBe('rejected');settlement=(await command(2,'settlement_prepare',{agentId:agent,period:'2026-03-01'})).id;
 await expect(command(2,'settlement_review',{id:settlement,decision:'approve'})).rejects.toThrow(/Independent/);await command(3,'settlement_review',{id:settlement,decision:'approve'});await expect(command(3,'settlement_approve',{id:settlement})).rejects.toThrow();await command(1,'settlement_approve',{id:settlement});
 const hold=await command(4,'refund_request',{walletId:wallet,policyId,amountMinor:'10000',accepted:true});
 const payment={id:settlement,kind:'commission',amountMinor:'400',bankReference:'FICTIONAL-COMMISSION-001',payeeReference:'Verified agent masked account 9876',paidOn:'2026-03-05'};
 await expect(command(2,'payment_record',payment)).rejects.toThrow(/unobstructed/);await command(4,'refund_cancel',{id:hold.id});
 await expect(command(3,'payment_record',payment)).rejects.toThrow();
 const record=await command(2,'payment_record',payment);expect((await as(5,"select public.read_partner_workspace('settlements') data"))[0].data.settlements[0].status).toBe('payment_pending');
 const before=(await db.query<any>('select sum(amount_minor)::text balance from public.wallet_entries where wallet_id=$1',[wallet])).rows[0].balance;
 await command(3,'payment_verify',{id:record.id,decision:'approve'});
 expect((await as(5,"select public.read_partner_workspace('settlements') data"))[0].data.settlements[0].status).toBe('paid');expect((await db.query<any>('select sum(amount_minor)::text balance from public.wallet_entries where wallet_id=$1',[wallet])).rows[0].balance).toBe(before);
});
it('retains paid history and independently approves limited negative corrections for later offset',async()=>{
 const correction=(await command(2,'commission_adjust',{id:commission,amountMinor:'-100'})).id;
 await expect(command(2,'commission_adjust',{id:commission,amountMinor:'-350'})).rejects.toThrow(/exceeds/);
 await expect(command(2,'commission_review',{id:correction,decision:'approve'})).rejects.toThrow(/Independent/);await command(3,'commission_review',{id:correction,decision:'approve'});
 const data=(await as(5,"select public.read_partner_workspace('commissions') data"))[0].data;expect(data.balances[0].amount_minor).toBe('-100');expect(data.settlements[0]).toMatchObject({status:'paid',total_minor:'400'});
 await expect(command(2,'settlement_prepare',{agentId:agent,period:'2026-03-01'})).rejects.toThrow(/positive/);
});
it('stores private, versioned contract files with scoped object access and rejects unrelated referral evidence',async()=>{
 const file=uid(850),path=`${agent}/${file}/document.pdf`;
 await expect(as(4,"insert into storage.objects(bucket_id,name) values('partner-documents',$1)",[path])).rejects.toThrow();
 await as(5,"insert into storage.objects(bucket_id,name) values('partner-documents',$1)",[path]);
 expect((await as(5,"select name from storage.objects")).length).toBe(0);
 const args=[file,agent,null,'agreement','FICTIONAL AGREEMENT.pdf',path,'application/pdf',200,'a'.repeat(64),null];
 await as(5,'select public.register_partner_file($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',args);
 expect((await as(5,'select public.read_partner_file($1) data',[file]))[0].data.path).toBe(path);
 expect((await as(5,'select name from storage.objects')).length).toBe(1);expect((await as(4,'select name from storage.objects')).length).toBe(0);
 await expect(as(3,'select public.read_partner_file($1)',[file])).rejects.toThrow(/Forbidden/);
 await expect(as(5,"update storage.objects set name='forged' where name=$1 returning name",[path])).resolves.toEqual([]);
 await expect(db.query("update public.partner_files set name='REWRITTEN.pdf' where id=$1",[file])).rejects.toThrow(/immutable/);
 const another=uid(851),badPath=`${agent}/${another}/document.pdf`;await as(5,"insert into storage.objects(bucket_id,name) values('partner-documents',$1)",[badPath]);
 await expect(as(5,'select public.register_partner_file($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[another,agent,null,'referral','NO RELATION.pdf',badPath,'application/pdf',200,'b'.repeat(64),null])).rejects.toThrow(/scope/);
});
it('does not expose raw tables, private objects, or paused agent data and protects forged file paths',async()=>{
 for(const n of [4,5,7,8])await expect(as(n,'select * from public.partner_commissions')).rejects.toThrow();
 expect((await as(5,"select public.can_partner_file_path('forged/path') allowed"))[0].allowed).toBe(false);
 expect((await as(5,'select public.can_partner_file_path($1,true) allowed',[`${uid(999)}/${uid(998)}/x.pdf`]))[0].allowed).toBe(false);
 const context=(await as(5,'select public.get_live_account_context() data'))[0].data;
 await command(1,'agent_save',{userId:uid(5),email:'partner5@example.test',label:'FICTIONAL AGENT',revision:context.revision,active:false});
 await expect(as(5,'select public.read_partner_workspace()')).rejects.toThrow(/unavailable/);await expect(as(5,'select public.get_home_attention()')).rejects.toThrow(/unavailable/);
 await command(1,'agent_save',{userId:uid(5),email:'partner5@example.test',label:'FICTIONAL AGENT',revision:context.revision+1,active:true});
 await expect(as(5,'select public.read_partner_workspace()')).rejects.toThrow(/sign-in/);await expect(as(5,'select public.get_home_attention()')).rejects.toThrow(/sign-in/);
});

it('scopes home reminders to each live role, separates independent work and removes completed work',async()=>{
 sessions.set(5,(await db.query<any>('insert into auth.sessions(user_id) values($1) returning id',[uid(5)])).rows[0].id);
 const get=async(n:number,aal='aal2')=>(await as(n,'select public.get_home_attention() data',[],aal))[0].data;
 for(const n of [1,2,3])expect((await get(n)).role).toBe('staff');await expect(get(3,'aal1')).rejects.toThrow();
 expect((await get(5,'aal1')).role).toBe('agent');expect((await get(4,'aal1')).role).toBe('client');
 for(const n of [7,8])await expect(get(n)).rejects.toThrow();
 const lead=await command(5,'lead_submit',{company:'PRIVATE REMINDER LEAD',note:'REMINDER FIXTURE'});
 expect((await get(1)).items.some((i:any)=>i.key==='lead_review'&&i.bucket==='action')).toBe(true);
 expect((await get(5,'aal1')).items.some((i:any)=>i.key==='lead_pending'&&i.bucket==='waiting')).toBe(true);
 for(const n of [4,6]){const result=await get(n,'aal1');expect(JSON.stringify(result)).not.toContain('PRIVATE REMINDER LEAD');expect(result.items.every((i:any)=>i.key.startsWith('client_')||i.key==='statement_unread')).toBe(true);}
 const otherBefore=await get(6,'aal1');
 const request=(await as(4,"select public.create_service_request($1,'account','HOME REMINDER QUESTION','REMINDER DETAILS') id",[org],'aal1'))[0].id;
 expect(await get(6,'aal1')).toEqual(otherBefore);
 const before=(await get(4,'aal1')).items.find((i:any)=>i.key==='client_service'&&i.bucket==='waiting').count;
 await as(1,"select public.reply_service_request($1,'REMINDER RESOLVED','resolved')",[request]);
 expect(((await get(4,'aal1')).items.find((i:any)=>i.key==='client_service'&&i.bucket==='waiting')?.count||0)).toBe(before-1);
 await command(1,'lead_review',{id:lead.id,decision:'confirmed',organizationId:org,note:'REMINDER CHECKED'});
 const activePolicy=(await db.query<any>('select id from public.refund_policies where wallet_id=$1 and active',[wallet])).rows[0].id;
 const refund=await command(4,'refund_request',{walletId:wallet,policyId:activePolicy,amountMinor:'1000',accepted:true});await command(2,'refund_prepare',{id:refund.id});
 expect((await get(2)).items.some((i:any)=>i.key==='refund_prepared'&&i.bucket==='action')).toBe(false);
 expect((await get(2)).items.some((i:any)=>i.key==='refund_prepared'&&i.bucket==='waiting')).toBe(true);
 expect((await get(3)).items.some((i:any)=>i.key==='refund_prepared'&&i.bucket==='action')).toBe(true);
 await command(3,'refund_review',{id:refund.id,decision:'reject'});
});

it('shows refund progress only to the related live agent and omits private verification data',async()=>{
 const {readFile}=await import('node:fs/promises');
 await db.exec(await readFile(new URL('../supabase/migrations/046_admin_account_credentials.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/047_agent_refund_progress.sql',import.meta.url),'utf8'));
 const activePolicy=(await db.query<any>('select id from public.refund_policies where wallet_id=$1 and active',[wallet])).rows[0].id;
 const r=(await command(4,'refund_request',{walletId:wallet,policyId:activePolicy,amountMinor:'1000',accepted:true,note:'PRIVATE BANK AND REASON'})).id;
 const get=async(n:number)=>(await as(n,'select public.read_agent_refund_progress() data',[],'aal1'))[0].data;
 for(const status of ['requested','prepared','reviewed','approved','payment_pending','paid','rejected','cancelled']){
  await db.query('update public.balance_refunds set status=$1,assessment=$2,review_note=$2 where id=$3',[status,'PRIVATE INTERNAL EVIDENCE',r]);
  const data=await get(5);const row=data.refunds.find((x:any)=>x.id===r);expect(row.status).toBe(status);
  expect(row.commission_paused).toBe(!['paid','rejected','cancelled'].includes(status));
  expect(JSON.stringify(data)).not.toMatch(/PRIVATE INTERNAL EVIDENCE|PRIVATE BANK AND REASON|bank_reference|policy_snapshot|assessment|review_note/);
 }
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid(9),'unrelated@example.test']);
 await db.query("insert into public.partner_agents(user_id,label,expected_email,active,agreement,created_by,session_after) values($1,'UNRELATED AGENT','unrelated@example.test',true,'FICTIONAL AGREEMENT',$2,now()-interval '1 day')",[uid(9),uid(1)]);
 sessions.set(9,(await db.query<any>('insert into auth.sessions(user_id) values($1) returning id',[uid(9)])).rows[0].id);
 expect((await get(9)).refunds).toEqual([]);
 // A newly assigned agent cannot acquire historical refund visibility by a backdated start month.
 await db.query("insert into public.partner_assignments(agent_id,organization_id,valid_from,rate_bps,basis,evidence,created_by,created_at) select id,$1,'2000-01-01',100,'service','FICTIONAL',$2,now()+interval '1 day' from public.partner_agents where user_id=$3",[org,uid(1),uid(9)]);
 expect((await get(9)).refunds).toEqual([]);
 for(const n of [1,4,6,7,8])await expect(get(n)).rejects.toThrow();
 await db.exec('begin;set local role anon');await expect(db.query('select public.read_agent_refund_progress()')).rejects.toThrow(/permission denied/);await db.exec('rollback');
 await db.query('update public.partner_agents set active=false where user_id=$1',[uid(9)]);await expect(get(9)).rejects.toThrow();
});
