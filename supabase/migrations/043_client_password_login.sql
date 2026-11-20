-- Client-only password login; financial staff actions retain MFA.
begin;
create or replace function public.require_live_account(p_mfa boolean default true) returns public.live_access_accounts language plpgsql security definer set search_path='' as $$
declare a public.live_access_accounts%rowtype;u jsonb;sid uuid;started timestamptz;
begin
 select * into a from public.live_access_accounts where user_id=auth.uid();
 if not found or not a.active or (p_mfa and a.role<>'client' and coalesce(auth.jwt()->>'aal','')<>'aal2') then raise exception 'Account unavailable or verification required' using errcode='42501';end if;
 select to_jsonb(v) into u from auth.users v where v.id=a.user_id;
 if lower(u->>'email') is distinct from a.expected_email or nullif(u->>'email_confirmed_at','') is null or nullif(u->>'deleted_at','') is not null or coalesce(nullif(u->>'banned_until','')::timestamptz,'-infinity')>now() then raise exception 'Account unavailable' using errcode='42501';end if;
 if exists(select 1 from public.staff_members where user_id=a.user_id) or exists(select 1 from public.memberships where user_id=a.user_id) then raise exception 'Conflicting account grants' using errcode='42501';end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid;exception when others then raise exception 'Fresh sign-in required' using errcode='42501';end;
 select s.created_at into started from auth.sessions s where s.id=sid and s.user_id=a.user_id;
 if started is null or started<a.session_after then raise exception 'Fresh sign-in required' using errcode='42501';end if;
 return a;
end $$;
create or replace function public.partner_finance_action(p_action text,p_request uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();owner boolean:=public.has_staff_access(array['admin']::text[]);aid uuid;org uuid;target uuid;result_id uuid;prior public.partner_actions%rowtype;
 a public.partner_agents%rowtype;r public.balance_refunds%rowtype;pol public.refund_policies%rowtype;w public.client_wallets%rowtype;c public.partner_commissions%rowtype;b public.partner_settlements%rowtype;pay public.partner_payments%rowtype;
 st public.monthly_client_statements%rowtype;assignment public.partner_assignments%rowtype;u jsonb;amount bigint;fee bigint;base bigint;total bigint;v_period date;note text:=btrim(p_data->>'note');decision text:=p_data->>'decision';canprepare boolean;canreview boolean;output jsonb;
begin
 if actor is null or (coalesce(auth.jwt()->>'aal','')<>'aal2' and not ((p_action='lead_submit' and exists(select 1 from public.partner_agents where user_id=actor)) or (p_action in ('refund_request','refund_cancel') and exists(select 1 from public.live_access_accounts where user_id=actor and role='client')))) then raise exception 'Verification required' using errcode='42501';end if;
 if p_request is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid command' using errcode='22023';end if;
 -- Refresh authorization even on an idempotent retry.
 if exists(select 1 from public.partner_agents where user_id=actor) then a:=public.require_partner_agent(true);
 elsif exists(select 1 from public.live_access_accounts where user_id=actor) then perform public.require_live_account(true);
 elsif not public.has_ops_capability('finance.read') and not exists(select 1 from public.finance_access f join public.memberships m using(organization_id,user_id) where f.user_id=actor and f.role='manager') then raise exception 'Forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('partner-action:'||actor::text||p_request::text,0));
 select * into prior from public.partner_actions where actor_id=actor and request_id=p_request;
 if found then if prior.input<>jsonb_build_object('action',p_action,'data',p_data) then raise exception 'Request conflict' using errcode='40001';end if;return prior.result;end if;
 if note is null or char_length(note) not between 3 and 1000 then raise exception 'Explanation required' using errcode='22023';end if;
 target:=nullif(p_data->>'id','')::uuid;
 if p_action='agent_save' then
  if not owner then raise exception 'Forbidden' using errcode='42501';end if;
  aid:=(p_data->>'userId')::uuid;perform pg_advisory_xact_lock(hashtextextended('live-access:'||aid::text,0));
  select to_jsonb(x) into u from auth.users x where x.id=aid;
  if aid=actor or lower(u->>'email') is distinct from lower(btrim(p_data->>'email')) or nullif(u->>'email_confirmed_at','') is null or nullif(u->>'deleted_at','') is not null or exists(select 1 from public.staff_members where user_id=aid) or exists(select 1 from public.memberships where user_id=aid) or exists(select 1 from public.live_access_accounts where user_id=aid) then raise exception 'Verified dedicated agent identity required' using errcode='22023';end if;
  if char_length(btrim(p_data->>'label')) not between 3 and 80 then raise exception 'Agent name required' using errcode='22023';end if;
  select * into a from public.partner_agents where user_id=aid for update;
  if found then
   if a.revision is distinct from (p_data->>'revision')::int or a.expected_email<>lower(btrim(p_data->>'email')) then raise exception 'Stale agent revision' using errcode='40001';end if;
   update public.partner_agents set label=btrim(p_data->>'label'),active=(p_data->>'active')::boolean,agreement=note,revision=revision+1,session_after=clock_timestamp() where id=a.id returning id into result_id;
  else
   if (p_data->>'revision')::int is distinct from 0 then raise exception 'Stale agent revision' using errcode='40001';end if;
   insert into public.partner_agents(user_id,label,expected_email,agreement,created_by) values(aid,btrim(p_data->>'label'),lower(btrim(p_data->>'email')),note,actor) returning id into result_id;
  end if;
 elsif p_action='lead_submit' then
  a:=public.require_partner_agent(true);perform 1 from public.partner_agents where id=a.id for update;if (select count(*) from public.partner_leads where agent_id=a.id and status='pending')>=50 then raise exception 'Pending lead limit reached' using errcode='54000';end if;insert into public.partner_leads(agent_id,company,note) values(a.id,btrim(p_data->>'company'),note) returning id into result_id;
 elsif p_action='lead_review' then
  if not owner or decision not in ('confirmed','rejected') then raise exception 'Forbidden' using errcode='42501';end if;
  update public.partner_leads set status=decision,review_note=note,organization_id=case when decision='confirmed' then (p_data->>'organizationId')::uuid else null end where id=target and status='pending' returning id into result_id;
  if result_id is null then raise exception 'Lead state changed' using errcode='40001';end if;
 elsif p_action='assignment_save' then
  if not owner then raise exception 'Forbidden' using errcode='42501';end if;
  org:=(p_data->>'organizationId')::uuid;aid:=(p_data->>'agentId')::uuid;v_period:=(p_data->>'from')::date;
  perform pg_advisory_xact_lock(hashtextextended('agent-assignment:'||org::text,0));
  if exists(select 1 from public.partner_assignments where organization_id=org and daterange(valid_from,valid_until,'[)') && daterange(v_period,nullif(p_data->>'until','')::date,'[)')) then raise exception 'Customer already assigned for this period' using errcode='23505';end if;
  insert into public.partner_assignments(agent_id,organization_id,valid_from,valid_until,rate_bps,basis,wait_days,evidence,created_by) values(aid,org,v_period,nullif(p_data->>'until','')::date,(p_data->>'rateBps')::int,p_data->>'basis',(p_data->>'waitDays')::int,note,actor) returning id into result_id;
 elsif p_action='assignment_end' then
  if not owner then raise exception 'Forbidden' using errcode='42501';end if;
  select * into assignment from public.partner_assignments where id=target for update;
  if not found or assignment.valid_until is not null or (p_data->>'until')::date<=greatest(assignment.valid_from,(now() at time zone 'Asia/Shanghai')::date) then raise exception 'Assignment closure must be a future date' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended('agent-assignment:'||assignment.organization_id::text,0));
  update public.partner_assignments set valid_until=(p_data->>'until')::date where id=target;result_id:=target;
 elsif p_action='refund_policy' then
  if not owner then raise exception 'Forbidden' using errcode='42501';end if;
  perform 1 from public.client_wallets where id=(p_data->>'walletId')::uuid and currency='CNY' for update;if not found then raise exception 'CNY wallet required' using errcode='22023';end if;
  update public.refund_policies set active=false where wallet_id=(p_data->>'walletId')::uuid and active;
  insert into public.refund_policies(wallet_id,mode,value,agreement,created_by) values((p_data->>'walletId')::uuid,p_data->>'mode',(p_data->>'value')::int,note,actor) returning id into result_id;
 elsif p_action='refund_request' then
  select * into w from public.client_wallets where id=(p_data->>'walletId')::uuid and currency='CNY' for update;
  if not found or not public.has_finance_access(w.organization_id,true) or exists(select 1 from public.staff_members where user_id=actor) then raise exception 'Client refund access required' using errcode='42501';end if;
  select * into pol from public.refund_policies where id=(p_data->>'policyId')::uuid and wallet_id=w.id and active;
  if not found then raise exception 'Refund agreement changed' using errcode='40001';end if;
  if (select count(*) from public.balance_refunds where wallet_id=w.id and status not in ('paid','rejected','cancelled'))>=10 then raise exception 'Too many pending refunds' using errcode='54000';end if;
  amount:=(p_data->>'amountMinor')::bigint;
  if amount is null or amount<=0 or amount>public.refund_available(w.id) or p_data->>'accepted' is distinct from 'true' then raise exception 'Insufficient refundable balance or consent missing' using errcode='22023';end if;
  fee:=case when pol.mode='fixed' then pol.value else floor((amount::numeric*pol.value+5000)/10000)::bigint end;
  if fee>=amount then raise exception 'Refund net amount must be positive' using errcode='22023';end if;
  insert into public.balance_refunds(wallet_id,organization_id,policy_id,gross_minor,fee_minor,net_minor,policy_snapshot,reason,requested_by) values(w.id,w.organization_id,pol.id,amount,fee,amount-fee,jsonb_build_object('mode',pol.mode,'value',pol.value,'agreement',pol.agreement),note,actor) returning id into result_id;
 elsif p_action like 'refund_%' then
  select * into r from public.balance_refunds where id=target;
  if not found then raise exception 'Refund unavailable' using errcode='42501';end if;
  perform 1 from public.client_wallets where id=r.wallet_id for update;
  select * into r from public.balance_refunds where id=target for update;
  canprepare:=public.has_ops_capability('finance.prepare',r.organization_id);canreview:=public.has_ops_capability('finance.review',r.organization_id);
  if p_action='refund_cancel' then
   if r.requested_by<>actor or not public.has_finance_access(r.organization_id,true) or r.status<>'requested' then raise exception 'Cannot cancel refund' using errcode='42501';end if;
   update public.balance_refunds set status='cancelled',review_note=note where id=target;
  elsif p_action='refund_prepare' then
   if not canprepare or r.status<>'requested' then raise exception 'Preparation unavailable' using errcode='42501';end if;
   if (select coalesce(sum(amount_minor),0) from public.wallet_entries where wallet_id=r.wallet_id)<public.refund_holds(r.wallet_id)+public.refund_committed(r.wallet_id) then raise exception 'Unsettled costs or funds unavailable' using errcode='22023';end if;
   update public.balance_refunds set status='prepared',prepared_by=actor,assessment=note where id=target;
  elsif p_action='refund_review' then
   if not canreview or r.prepared_by=actor or r.status<>'prepared' or decision is null or decision not in ('approve','reject') then raise exception 'Independent review required' using errcode='42501';end if;
   update public.balance_refunds set status=case when decision='approve' then 'reviewed' else 'rejected' end,reviewed_by=actor,review_note=note where id=target;
  elsif p_action='refund_approve' then
   if not owner or r.status<>'reviewed' then raise exception 'Administrator approval required' using errcode='42501';end if;
   update public.balance_refunds set status='approved',approved_by=actor where id=target;
  elsif p_action='refund_withdraw' then
   if not owner or r.status not in ('prepared','reviewed','approved') or exists(select 1 from public.partner_payments where kind='refund' and target_id=target and status<>'rejected') then raise exception 'Only unpaid refund can be withdrawn by administrator' using errcode='42501';end if;
   update public.balance_refunds set status='cancelled',review_note=note where id=target;
  elsif p_action='refund_reject' then
   if not canprepare or r.status<>'requested' then raise exception 'Rejection unavailable' using errcode='42501';end if;
   update public.balance_refunds set status='rejected',review_note=note where id=target;
  else raise exception 'Unknown refund action' using errcode='22023';end if;result_id:=target;
 elsif p_action='commission_prepare' then
  select * into st from public.monthly_client_statements where id=(p_data->>'statementId')::uuid;
  if not found or not public.has_ops_capability('finance.prepare',st.organization_id) then raise exception 'Forbidden' using errcode='42501';end if;
  perform 1 from public.client_wallets where id=st.wallet_id for update;
  select * into assignment from public.partner_assignments where organization_id=st.organization_id and st.month>=valid_from and (valid_until is null or st.month<valid_until);
  if not found or not exists(select 1 from public.bank_receipts where wallet_id=st.wallet_id and status='credited') then raise exception 'Confirmed assignment and actual receipt required' using errcode='22023';end if;
  if coalesce((select sum(amount_minor) from public.bank_receipts where wallet_id=st.wallet_id and status='credited'),0)-coalesce((select sum(gross_minor) from public.balance_refunds where wallet_id=st.wallet_id and status='paid'),0)<(select coalesce(sum(total_cny_minor),0) from public.monthly_client_statements where wallet_id=st.wallet_id and published_at<=st.published_at) then raise exception 'Published business is not backed by confirmed actual receipts' using errcode='22023';end if;
  if public.partner_org_refund_hold(st.organization_id) then raise exception 'Refund under review; commission paused' using errcode='22023';end if;
  base:=case when assignment.basis='service' then st.service_cny_minor else st.total_cny_minor end;
  amount:=floor((base::numeric*assignment.rate_bps+5000)/10000)::bigint;
  if amount<=0 then raise exception 'No earned commission' using errcode='22023';end if;
  insert into public.partner_commissions(agent_id,assignment_id,organization_id,statement_id,period,kind,base_minor,rate_bps,amount_minor,basis,available_on,evidence,prepared_by) values(assignment.agent_id,assignment.id,st.organization_id,st.id,st.month,'earned',base,assignment.rate_bps,amount,assignment.basis,greatest((st.published_at at time zone 'Asia/Shanghai')::date,st.month)+assignment.wait_days,note,actor) returning id into result_id;
 elsif p_action='commission_adjust' then
  select * into c from public.partner_commissions where id=target;
  if not found or c.kind<>'earned' or c.status<>'approved' or not public.has_ops_capability('finance.prepare',c.organization_id) then raise exception 'Approved commission and preparation access required' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended('commission-adjust:'||target::text,0));amount:=(p_data->>'amountMinor')::bigint;
  if amount is null or amount>=0 or -amount>c.amount_minor+coalesce((select sum(amount_minor) from public.partner_commissions where parent_id=c.id and status<>'rejected'),0) then raise exception 'Adjustment exceeds original commission' using errcode='22023';end if;
  insert into public.partner_commissions(agent_id,assignment_id,organization_id,statement_id,parent_id,period,kind,base_minor,rate_bps,amount_minor,basis,available_on,evidence,prepared_by) values(c.agent_id,c.assignment_id,c.organization_id,c.statement_id,c.id,date_trunc('month',now() at time zone 'Asia/Shanghai')::date,'adjustment',0,c.rate_bps,amount,c.basis,(now() at time zone 'Asia/Shanghai')::date,note,actor) returning id into result_id;
 elsif p_action='commission_review' then
  select * into c from public.partner_commissions where id=target for update;
  if not found or not public.has_ops_capability('finance.review',c.organization_id) or c.prepared_by=actor or c.status<>'pending' or decision is null or decision not in ('approve','reject') then raise exception 'Independent review required' using errcode='42501';end if;
  update public.partner_commissions set status=case when decision='approve' then 'approved' else 'rejected' end,reviewed_by=actor,review_note=note where id=target;result_id:=target;
 elsif p_action='settlement_prepare' then
  aid:=(p_data->>'agentId')::uuid;v_period:=(p_data->>'period')::date;
  if not public.has_ops_capability('finance.prepare') or v_period is null or v_period<>date_trunc('month',v_period)::date or v_period>=date_trunc('month',now() at time zone 'Asia/Shanghai')::date then raise exception 'Closed Beijing calendar month required' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended('agent-settlement:'||aid::text,0));
  perform 1 from public.partner_commissions where agent_id=aid and status='approved' and settlement_id is null for update;
  if exists(select 1 from public.partner_commissions where agent_id=aid and kind='adjustment' and status='pending') then raise exception 'Pending adjustment must be reviewed first' using errcode='22023';end if;
  select coalesce(sum(x.amount_minor),0) into total from public.partner_commissions x where x.agent_id=aid and x.status='approved' and x.settlement_id is null and x.available_on<=(now() at time zone 'Asia/Shanghai')::date and (x.kind='adjustment' or (x.period<=(p_data->>'period')::date and not public.partner_org_refund_hold(x.organization_id)));
  if total<=0 then raise exception 'No positive eligible settlement; deductions carry forward' using errcode='22023';end if;
  insert into public.partner_settlements(agent_id,period,total_minor,prepared_by) values(aid,v_period,total,actor) returning id into result_id;
  insert into public.partner_settlement_items select result_id,x.id,x.amount_minor from public.partner_commissions x where x.agent_id=aid and x.status='approved' and x.settlement_id is null and x.available_on<=(now() at time zone 'Asia/Shanghai')::date and (x.kind='adjustment' or (x.period<=(p_data->>'period')::date and not public.partner_org_refund_hold(x.organization_id)));
  update public.partner_commissions set settlement_id=result_id where id in(select commission_id from public.partner_settlement_items where settlement_id=result_id);
 elsif p_action='settlement_cancel' then
  select * into b from public.partner_settlements where id=target for update;
  if not found or not owner or b.status not in ('prepared','reviewed','approved') or exists(select 1 from public.partner_payments where kind='commission' and target_id=target and status<>'rejected') then raise exception 'Only unpaid settlement can be withdrawn by administrator' using errcode='42501';end if;
  update public.partner_settlements set status='rejected',review_note=note where id=target;update public.partner_commissions set settlement_id=null where settlement_id=target;result_id:=target;
 elsif p_action in ('settlement_review','settlement_approve') then
  select * into b from public.partner_settlements where id=target for update;
  if not found then raise exception 'Settlement unavailable' using errcode='42501';end if;
  if exists(select 1 from public.partner_settlement_items i join public.partner_commissions x on x.id=i.commission_id where i.settlement_id=b.id and x.kind='earned' and public.partner_org_refund_hold(x.organization_id)) or exists(select 1 from public.partner_commissions x where x.agent_id=b.agent_id and x.kind='adjustment' and x.status<>'rejected' and x.settlement_id is null) then raise exception 'Refund or deduction under review; settlement paused' using errcode='22023';end if;
  if p_action='settlement_review' then
   if not public.has_ops_capability('finance.review') or b.prepared_by=actor or b.status<>'prepared' or decision is null or decision not in ('approve','reject') then raise exception 'Independent review required' using errcode='42501';end if;
   update public.partner_settlements set status=case when decision='approve' then 'reviewed' else 'rejected' end,reviewed_by=actor,review_note=note where id=target;
   if decision='reject' then update public.partner_commissions set settlement_id=null where settlement_id=target;end if;
  else
   if not owner or b.status<>'reviewed' then raise exception 'Administrator approval required' using errcode='42501';end if;
   update public.partner_settlements set status='approved',approved_by=actor where id=target;
  end if;result_id:=target;
 elsif p_action='payment_record' then
  if not public.has_ops_capability('finance.prepare') then raise exception 'Forbidden' using errcode='42501';end if;
  if p_data->>'kind'='refund' then
   select * into r from public.balance_refunds where id=target;perform 1 from public.client_wallets where id=r.wallet_id for update;select * into r from public.balance_refunds where id=target for update;
   if r.id is null or r.status<>'approved' then raise exception 'Approved refund required' using errcode='22023';end if;amount:=r.net_minor;
   update public.balance_refunds set status='payment_pending' where id=target;
  elsif p_data->>'kind'='commission' then
   select * into b from public.partner_settlements where id=target for update;
   if not found or b.status<>'approved' or exists(select 1 from public.partner_settlement_items i join public.partner_commissions x on x.id=i.commission_id where i.settlement_id=b.id and ((x.kind='earned' and public.partner_org_refund_hold(x.organization_id)) or exists(select 1 from public.partner_commissions adj where adj.agent_id=b.agent_id and adj.kind='adjustment' and adj.settlement_id is null and adj.status<>'rejected'))) then raise exception 'Approved unobstructed settlement required' using errcode='22023';end if;
   amount:=b.total_minor;update public.partner_settlements set status='payment_pending' where id=target;
  else raise exception 'Invalid payment kind' using errcode='22023';end if;
  if (p_data->>'amountMinor')::bigint is distinct from amount or (p_data->>'paidOn')::date>(now() at time zone 'Asia/Shanghai')::date then raise exception 'Payment amount/date mismatch' using errcode='22023';end if;
  insert into public.partner_payments(kind,target_id,bank_reference,payee_reference,evidence,amount_minor,paid_on,prepared_by) values(p_data->>'kind',target,btrim(p_data->>'bankReference'),btrim(p_data->>'payeeReference'),note,amount,(p_data->>'paidOn')::date,actor) returning id into result_id;
 elsif p_action='payment_verify' then
  select * into pay from public.partner_payments where id=target;
  if pay.kind='refund' then select * into r from public.balance_refunds where id=pay.target_id;perform 1 from public.client_wallets where id=r.wallet_id for update;end if;
  select * into pay from public.partner_payments where id=target for update;
  if not found or not public.has_ops_capability('finance.review') or pay.prepared_by=actor or pay.status<>'pending' or decision is null or decision not in ('approve','reject') then raise exception 'Independent payment verification required' using errcode='42501';end if;
  if pay.kind='commission' then
   perform 1 from public.partner_settlements where id=pay.target_id for update;
   update public.partner_settlements set status=case when decision='approve' then 'paid' else 'approved' end,paid_at=case when decision='approve' then now() end where id=pay.target_id and status='payment_pending';
  else
   select * into r from public.balance_refunds where id=pay.target_id for update;
   if r.status<>'payment_pending' then raise exception 'Refund state changed' using errcode='40001';end if;
   update public.balance_refunds set status=case when decision='approve' then 'paid' else 'approved' end,paid_at=case when decision='approve' then now() end where id=r.id;
   if decision='approve' then
    insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values(r.wallet_id,r.organization_id,'CNY','refund',-r.net_minor,'客户余额退款','balance-refund:'||r.id::text);
    if r.fee_minor>0 then insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values(r.wallet_id,r.organization_id,'CNY','service_fee',-r.fee_minor,'约定退款手续费','balance-refund:'||r.id::text);end if;
   end if;
  end if;
  update public.partner_payments set status=case when decision='approve' then 'verified' else 'rejected' end,verified_by=actor,review_note=note where id=target;result_id:=target;
 else raise exception 'Unknown action' using errcode='22023';end if;
 output:=jsonb_build_object('id',result_id,'action',p_action);
 insert into public.partner_actions values(actor,p_request,jsonb_build_object('action',p_action,'data',p_data),output,now());
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(actor,'partner_finance',result_id,'INSERT',jsonb_build_object('action',p_action,'request_id',p_request));return output;
end $$;
create or replace function public.read_refund_workspace() returns jsonb language plpgsql security definer set search_path='' as $$
declare staff boolean:=public.has_ops_capability('finance.read');owner boolean:=public.has_staff_access(array['admin']::text[]);begin
 if coalesce(auth.jwt()->>'aal','')<>'aal2' and not public.has_live_client_access((public.require_live_account(true)).organization_id) then raise exception 'Verification required' using errcode='42501';end if;
 if not staff and not exists(select 1 from public.client_wallets where public.has_finance_access(organization_id)) then raise exception 'Client financial access required' using errcode='42501';end if;
 return jsonb_build_object('staff',staff,'owner',owner,
 'wallets',(select coalesce(jsonb_agg(t),'[]') from (select w.id,w.organization_id,o.name,w.currency,public.has_finance_access(w.organization_id,true) can_request,coalesce((select sum(amount_minor)::text from public.wallet_entries where wallet_id=w.id),'0') balance_minor,public.refund_holds(w.id)::text held_minor,public.refund_available(w.id)::text available_minor,(select jsonb_build_object('id',p.id,'mode',p.mode,'value',p.value,'agreement',p.agreement) from public.refund_policies p where p.wallet_id=w.id and p.active) policy from public.client_wallets w join public.organizations o on o.id=w.organization_id where w.currency='CNY' and (staff or public.has_finance_access(w.organization_id)) order by o.name limit 500)t),
 'refunds',(select coalesce(jsonb_agg(t),'[]') from (select r.id,r.wallet_id,r.organization_id,o.name company,r.gross_minor::text,r.fee_minor::text,r.net_minor::text,r.policy_snapshot,r.reason,r.status,r.review_note,case when staff then r.assessment end assessment,r.prepared_by=auth.uid() prepared_by_me,r.requested_by=auth.uid() requested_by_me,r.created_at,r.paid_at from public.balance_refunds r join public.organizations o on o.id=r.organization_id where staff or public.has_finance_access(r.organization_id) order by r.created_at desc limit 200)t),
 'payments',(select coalesce(jsonb_agg(t),'[]') from (select x.id,x.kind,x.target_id,x.amount_minor::text,x.paid_on,x.status,x.prepared_by=auth.uid() prepared_by_me,case when staff then x.bank_reference end bank_reference,case when staff then x.payee_reference end payee_reference,case when staff then x.evidence end evidence from public.partner_payments x join public.balance_refunds r on r.id=x.target_id and x.kind='refund' where staff or public.has_finance_access(r.organization_id) order by x.created_at desc limit 200)t));
end $$;
notify pgrst, 'reload schema';
commit;
