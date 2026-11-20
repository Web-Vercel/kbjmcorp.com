-- External referral agents and customer balance refunds. No accounts, fees or money seeded.
begin;
do $$begin if not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='get_business_analytics') then raise exception 'Apply existing migrations through 040 before 041';end if;end $$;
create table public.partner_agents (
 id uuid primary key default gen_random_uuid(),user_id uuid not null unique references auth.users(id),
 label text not null check(char_length(label) between 3 and 80),expected_email text not null,
 active boolean not null default false,revision integer not null default 1,session_after timestamptz not null default clock_timestamp(),
 agreement text not null check(char_length(btrim(agreement)) between 3 and 1000),created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create table public.partner_assignments (
 id uuid primary key default gen_random_uuid(),agent_id uuid not null references public.partner_agents(id),organization_id uuid not null references public.organizations(id),
 valid_from date not null,valid_until date,rate_bps integer not null check(rate_bps between 0 and 10000),basis text not null check(basis in ('service','total')),
 wait_days integer not null default 30 check(wait_days between 0 and 365),evidence text not null check(char_length(btrim(evidence)) between 3 and 1000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),check(extract(day from valid_from)=1 and (valid_until is null or (valid_until>valid_from and extract(day from valid_until)=1)))
);
create index partner_assignment_org on public.partner_assignments(organization_id,valid_from);
create table public.partner_leads (
 id uuid primary key default gen_random_uuid(),agent_id uuid not null references public.partner_agents(id),company text not null check(char_length(company) between 2 and 180),
 note text not null check(char_length(note) between 3 and 1000),status text not null default 'pending' check(status in ('pending','confirmed','rejected')),organization_id uuid references public.organizations(id),review_note text,created_at timestamptz not null default now()
);
create table public.refund_policies (
 id uuid primary key default gen_random_uuid(),wallet_id uuid not null references public.client_wallets(id),mode text not null check(mode in ('fixed','percent')),
 value integer not null check(value>0 and value<=99999999),agreement text not null check(char_length(btrim(agreement)) between 3 and 1000),
 active boolean not null default true,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),check(mode<>'percent' or value<=10000)
);
create unique index one_active_refund_policy on public.refund_policies(wallet_id) where active;
create table public.balance_refunds (
 id uuid primary key default gen_random_uuid(),wallet_id uuid not null,organization_id uuid not null,currency text not null default 'CNY' check(currency='CNY'),
 policy_id uuid not null references public.refund_policies(id),gross_minor bigint not null check(gross_minor>0 and gross_minor<=9999999999),
 fee_minor bigint not null check(fee_minor>=0),net_minor bigint not null check(net_minor>0),policy_snapshot jsonb not null,reason text not null check(char_length(reason) between 3 and 1000),
 status text not null default 'requested' check(status in ('requested','prepared','reviewed','approved','payment_pending','paid','rejected','cancelled')),
 requested_by uuid not null references auth.users(id),prepared_by uuid references auth.users(id),reviewed_by uuid references auth.users(id),approved_by uuid references auth.users(id),
 assessment text,review_note text,created_at timestamptz not null default now(),paid_at timestamptz,
 foreign key(wallet_id,organization_id,currency) references public.client_wallets(id,organization_id,currency),check(gross_minor=fee_minor+net_minor)
);
create index refund_wallet_holds on public.balance_refunds(wallet_id,status);
create table public.partner_commissions (
 id uuid primary key default gen_random_uuid(),agent_id uuid not null references public.partner_agents(id),assignment_id uuid not null references public.partner_assignments(id),
 organization_id uuid not null references public.organizations(id),statement_id uuid not null references public.monthly_client_statements(id),
 parent_id uuid references public.partner_commissions(id),period date not null,kind text not null check(kind in ('earned','adjustment')),
 base_minor bigint not null check(base_minor>=0),rate_bps integer not null check(rate_bps between 0 and 10000),amount_minor bigint not null check(amount_minor<>0 and abs(amount_minor)<=9999999999),
 basis text not null,available_on date not null,evidence text not null check(char_length(evidence) between 3 and 1000),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),prepared_by uuid not null references auth.users(id),reviewed_by uuid references auth.users(id),review_note text,
 settlement_id uuid,created_at timestamptz not null default now()
);
create unique index one_earned_commission_per_statement on public.partner_commissions(statement_id) where kind='earned' and status<>'rejected';
create table public.partner_settlements (
 id uuid primary key default gen_random_uuid(),agent_id uuid not null references public.partner_agents(id),period date not null,total_minor bigint not null check(total_minor>0),
 status text not null default 'prepared' check(status in ('prepared','reviewed','approved','payment_pending','paid','rejected')),prepared_by uuid not null references auth.users(id),reviewed_by uuid references auth.users(id),approved_by uuid references auth.users(id),
 review_note text,created_at timestamptz not null default now(),paid_at timestamptz
);
alter table public.partner_commissions add foreign key(settlement_id) references public.partner_settlements(id);
create table public.partner_settlement_items (
 settlement_id uuid not null references public.partner_settlements(id),commission_id uuid not null references public.partner_commissions(id),amount_minor bigint not null,
 primary key(settlement_id,commission_id)
);
create table public.partner_payments (
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('refund','commission')),target_id uuid not null,
 bank_reference text not null check(char_length(btrim(bank_reference)) between 3 and 160),payee_reference text not null check(char_length(btrim(payee_reference)) between 3 and 300),
 evidence text not null check(char_length(btrim(evidence)) between 3 and 1000),amount_minor bigint not null check(amount_minor>0),paid_on date not null,
 status text not null default 'pending' check(status in ('pending','verified','rejected')),prepared_by uuid not null references auth.users(id),verified_by uuid references auth.users(id),review_note text,created_at timestamptz not null default now()
);
create unique index partner_payment_bank_reference on public.partner_payments(upper(regexp_replace(bank_reference,'[[:space:]]','','g'))) where status<>'rejected';
create unique index partner_payment_target on public.partner_payments(kind,target_id) where status<>'rejected';
create table public.partner_files (
 id uuid primary key,agent_id uuid not null references public.partner_agents(id),lead_id uuid references public.partner_leads(id),assignment_id uuid references public.partner_assignments(id),
 kind text not null check(kind in ('agreement','referral')),name text not null check(char_length(name) between 1 and 180),object_path text not null unique,
 mime text not null check(mime in ('application/pdf','image/png','image/jpeg')),size_bytes integer not null check(size_bytes between 1 and 4194304),sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 uploaded_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create table public.partner_actions (
 actor_id uuid not null references auth.users(id),request_id uuid not null,input jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(actor_id,request_id)
);
do $$declare t text;begin foreach t in array array['partner_agents','partner_assignments','partner_leads','refund_policies','balance_refunds','partner_commissions','partner_settlements','partner_settlement_items','partner_payments','partner_files','partner_actions'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);
end loop;end $$;
create function public.guard_partner_record_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'Financial history is immutable' using errcode='42501';end if;
 if TG_TABLE_NAME='balance_refunds' and (to_jsonb(NEW)-array['status','prepared_by','reviewed_by','approved_by','assessment','review_note','paid_at']) is distinct from (to_jsonb(OLD)-array['status','prepared_by','reviewed_by','approved_by','assessment','review_note','paid_at']) then raise exception 'Refund snapshot is immutable' using errcode='42501';end if;
 if TG_TABLE_NAME='partner_commissions' and (to_jsonb(NEW)-array['status','reviewed_by','review_note','settlement_id']) is distinct from (to_jsonb(OLD)-array['status','reviewed_by','review_note','settlement_id']) then raise exception 'Commission snapshot is immutable' using errcode='42501';end if;
 if TG_TABLE_NAME='partner_settlements' and (to_jsonb(NEW)-array['status','reviewed_by','approved_by','review_note','paid_at']) is distinct from (to_jsonb(OLD)-array['status','reviewed_by','approved_by','review_note','paid_at']) then raise exception 'Settlement snapshot is immutable' using errcode='42501';end if;
 if TG_TABLE_NAME='partner_assignments' and ((to_jsonb(NEW)-'valid_until') is distinct from (to_jsonb(OLD)-'valid_until') or (to_jsonb(OLD)->>'valid_until') is not null) then raise exception 'Assignment history is immutable' using errcode='42501';end if;
 if TG_TABLE_NAME='refund_policies' and (to_jsonb(NEW)-'active') is distinct from (to_jsonb(OLD)-'active') then raise exception 'Fee agreement is immutable' using errcode='42501';end if;
 return NEW;
end $$;
create trigger refund_snapshot_history before update or delete on public.balance_refunds for each row execute function public.guard_partner_record_history();
create trigger commission_snapshot_history before update or delete on public.partner_commissions for each row execute function public.guard_partner_record_history();
create trigger settlement_snapshot_history before update or delete on public.partner_settlements for each row execute function public.guard_partner_record_history();
create trigger assignment_snapshot_history before update or delete on public.partner_assignments for each row execute function public.guard_partner_record_history();
create trigger refund_policy_history before update or delete on public.refund_policies for each row execute function public.guard_partner_record_history();
create trigger immutable_partner_file before update or delete on public.partner_files for each row execute function public.lock_posted_money();
create trigger immutable_settlement_items before update or delete on public.partner_settlement_items for each row execute function public.lock_posted_money();
create function public.require_partner_agent(p_mfa boolean default true) returns public.partner_agents language plpgsql security definer set search_path='' as $$
declare a public.partner_agents%rowtype;u jsonb;started timestamptz;begin
 select * into a from public.partner_agents where user_id=auth.uid();
 if not found or not a.active or (p_mfa and coalesce(auth.jwt()->>'aal','')<>'aal2') then raise exception 'Agent unavailable or verification required' using errcode='42501';end if;
 select to_jsonb(x) into u from auth.users x where x.id=a.user_id;
 if lower(u->>'email') is distinct from a.expected_email or nullif(u->>'email_confirmed_at','') is null or nullif(u->>'deleted_at','') is not null or coalesce(nullif(u->>'banned_until','')::timestamptz,'-infinity')>now() then raise exception 'Agent unavailable' using errcode='42501';end if;
 if exists(select 1 from public.live_access_accounts where user_id=a.user_id) or exists(select 1 from public.staff_members where user_id=a.user_id) or exists(select 1 from public.memberships where user_id=a.user_id) then raise exception 'Conflicting agent identity' using errcode='42501';end if;
 select created_at into started from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=a.user_id;
 if started is null or started<a.session_after then raise exception 'Fresh sign-in required' using errcode='42501';end if;return a;
end $$;
create or replace function public.guard_live_account_grants() returns trigger language plpgsql security definer set search_path='' as $$
begin if exists(select 1 from public.live_access_accounts where user_id=NEW.user_id) or exists(select 1 from public.partner_agents where user_id=NEW.user_id) then raise exception 'Scoped account cannot receive legacy grants' using errcode='42501';end if;return NEW;end $$;
-- Keep dedicated agent identities out of the existing single-company roles.
create function public.guard_agent_live() returns trigger language plpgsql security definer set search_path='' as $$begin if exists(select 1 from public.partner_agents where user_id=NEW.user_id) then raise exception 'Agent cannot receive client or sales access' using errcode='42501';end if;return NEW;end $$;
create trigger no_agent_live before insert or update on public.live_access_accounts for each row execute function public.guard_agent_live();
create or replace function public.get_live_account_context(p_mfa boolean default true) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.live_access_accounts%rowtype;g public.partner_agents%rowtype;begin
 if exists(select 1 from public.partner_agents where user_id=auth.uid()) then g:=public.require_partner_agent(p_mfa);return jsonb_build_object('user_id',g.user_id,'organization_id',g.id,'organization_name','代理门户','role','agent','label',g.label,'revision',g.revision);end if;
 a:=public.require_live_account(p_mfa);return jsonb_build_object('user_id',a.user_id,'organization_id',a.organization_id,'organization_name',(select name from public.organizations where id=a.organization_id),'role',a.role,'label',a.label,'revision',a.revision);
end $$;
create function public.refund_holds(p_wallet uuid) returns bigint language sql stable security definer set search_path='' as $$select coalesce(sum(gross_minor),0)::bigint from public.balance_refunds where wallet_id=p_wallet and status not in ('paid','rejected','cancelled')$$;
create function public.refund_committed(p_wallet uuid) returns bigint language sql stable security definer set search_path='' as $$
 select coalesce(sum(d.total_cny_minor),0)::bigint from public.monthly_settlement_drafts d join public.client_wallets w on w.organization_id=d.organization_id and w.id=p_wallet
 where exists(select 1 from public.monthly_settlement_reviews mr where mr.draft_id=d.id and mr.decision='approved')
 and not exists(select 1 from public.agency_quote_lifecycle q where q.quote_id=d.quote_id and q.archived)
 and not exists(select 1 from public.monthly_client_statements s where s.binding_id=d.binding_id and s.month=d.month)
$$;
create function public.refund_available(p_wallet uuid) returns bigint language sql stable security definer set search_path='' as $$
 select greatest(0,coalesce((select sum(amount_minor) from public.wallet_entries where wallet_id=p_wallet),0)-public.refund_holds(p_wallet)-public.refund_committed(p_wallet))::bigint
$$;
-- Lock the same wallet as publication/receipt posting. No debit can spend funds reserved for a refund.
create function public.guard_refund_reserved_balance() returns trigger language plpgsql security definer set search_path='' as $$declare balance bigint;begin
 perform 1 from public.client_wallets where id=NEW.wallet_id for update;
 if NEW.amount_minor<0 then select coalesce(sum(amount_minor),0) into balance from public.wallet_entries where wallet_id=NEW.wallet_id;
 if public.refund_holds(NEW.wallet_id)>0 and balance+NEW.amount_minor<public.refund_holds(NEW.wallet_id) then raise exception 'Funds reserved for refund; available balance insufficient' using errcode='22023';end if;end if;return NEW;
end $$;
create trigger protect_refund_reserve before insert on public.wallet_entries for each row execute function public.guard_refund_reserved_balance();
create function public.partner_org_refund_hold(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.balance_refunds where organization_id=p_org and status not in ('paid','rejected','cancelled'))$$;
-- A single audited command boundary: all permission, amount, state, replay and independent-review checks live in the database.
create function public.partner_finance_action(p_action text,p_request uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();owner boolean:=public.has_staff_access(array['admin']::text[]);aid uuid;org uuid;target uuid;result_id uuid;prior public.partner_actions%rowtype;
 a public.partner_agents%rowtype;r public.balance_refunds%rowtype;pol public.refund_policies%rowtype;w public.client_wallets%rowtype;c public.partner_commissions%rowtype;b public.partner_settlements%rowtype;pay public.partner_payments%rowtype;
 st public.monthly_client_statements%rowtype;assignment public.partner_assignments%rowtype;u jsonb;amount bigint;fee bigint;base bigint;total bigint;v_period date;note text:=btrim(p_data->>'note');decision text:=p_data->>'decision';canprepare boolean;canreview boolean;output jsonb;
begin
 if actor is null or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Verification required' using errcode='42501';end if;
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
create function public.read_partner_workspace(p_view text default 'overview') returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.partner_agents%rowtype;staff boolean:=public.has_ops_capability('finance.read');owner boolean:=public.has_staff_access(array['admin']::text[]);result jsonb;begin
 if not staff then a:=public.require_partner_agent(true);end if;
 if p_view not in ('overview','clients','commissions','settlements','files','settings') or (p_view='settings' and not owner) then raise exception 'Forbidden' using errcode='42501';end if;
 select jsonb_build_object('agentId',a.id,'label',a.label,'staff',staff,'owner',owner,
 'agents',case when staff then (select coalesce(jsonb_agg(t),'[]') from (select id,user_id,label,active,revision,case when owner then expected_email end email,case when owner then agreement end agreement from public.partner_agents order by created_at desc limit 200)t) else '[]'::jsonb end,
 'clients',(select coalesce(jsonb_agg(t),'[]') from (select x.id,x.agent_id,x.organization_id,o.name,x.valid_from,x.valid_until,x.rate_bps,x.basis,x.wait_days from public.partner_assignments x join public.organizations o on o.id=x.organization_id where staff or x.agent_id=a.id order by x.created_at desc limit 200)t),
 'leads',(select coalesce(jsonb_agg(t),'[]') from (select id,agent_id,company,note,status,review_note,created_at from public.partner_leads where staff or agent_id=a.id order by created_at desc limit 200)t),
 'commissions',(select coalesce(jsonb_agg(t),'[]') from (select x.id,x.agent_id,o.name company,x.organization_id,x.statement_id,x.parent_id,x.period,x.kind,x.base_minor::text,x.rate_bps,x.amount_minor::text,x.basis,x.available_on,x.status,x.settlement_id,x.prepared_by=auth.uid() prepared_by_me,public.partner_org_refund_hold(x.organization_id) refund_hold,case when staff then x.evidence end evidence,x.review_note from public.partner_commissions x join public.organizations o on o.id=x.organization_id where staff or x.agent_id=a.id order by x.created_at desc limit 200)t),
 'settlements',(select coalesce(jsonb_agg(t),'[]') from (select x.id,x.agent_id,x.period,x.total_minor::text,x.status,x.paid_at,x.prepared_by=auth.uid() prepared_by_me,x.review_note,(select coalesce(jsonb_agg(jsonb_build_object('commissionId',i.commission_id,'amountMinor',i.amount_minor::text)),'[]') from public.partner_settlement_items i where i.settlement_id=x.id) items from public.partner_settlements x where staff or x.agent_id=a.id order by x.created_at desc limit 200)t),
 'payments',(select coalesce(jsonb_agg(t),'[]') from (select x.id,x.kind,x.target_id,x.amount_minor::text,x.paid_on,x.status,x.prepared_by=auth.uid() prepared_by_me,case when staff then x.bank_reference end bank_reference,case when staff then x.payee_reference end payee_reference,case when staff then x.evidence end evidence from public.partner_payments x where (staff and x.kind='commission') or (x.kind='commission' and exists(select 1 from public.partner_settlements s where s.id=x.target_id and s.agent_id=a.id)) order by x.created_at desc limit 200)t),
 'files',(select coalesce(jsonb_agg(t),'[]') from (select id,agent_id,lead_id,assignment_id,kind,name,mime,size_bytes,sha256,created_at from public.partner_files where (owner or agent_id=a.id) order by created_at desc limit 200)t),
 'organizations',case when staff then (select coalesce(jsonb_agg(t),'[]') from (select id,name from public.organizations order by name limit 500)t) else '[]'::jsonb end,
 'statements',case when staff then (select coalesce(jsonb_agg(t),'[]') from (select s.id,s.organization_id,o.name,s.month,s.total_cny_minor::text from public.monthly_client_statements s join public.organizations o on o.id=s.organization_id order by s.published_at desc limit 200)t) else '[]'::jsonb end,
 'balances',(select coalesce(jsonb_agg(t),'[]') from (select x.agent_id,sum(x.amount_minor)::text amount_minor from public.partner_commissions x where x.status='approved' and x.settlement_id is null and (staff or x.agent_id=a.id) group by x.agent_id)t)
 ) into result;return result;
end $$;
create function public.read_refund_workspace() returns jsonb language plpgsql security definer set search_path='' as $$
declare staff boolean:=public.has_ops_capability('finance.read');owner boolean:=public.has_staff_access(array['admin']::text[]);begin
 if coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Verification required' using errcode='42501';end if;
 if not staff and not exists(select 1 from public.client_wallets where public.has_finance_access(organization_id)) then raise exception 'Client financial access required' using errcode='42501';end if;
 return jsonb_build_object('staff',staff,'owner',owner,
 'wallets',(select coalesce(jsonb_agg(t),'[]') from (select w.id,w.organization_id,o.name,w.currency,public.has_finance_access(w.organization_id,true) can_request,coalesce((select sum(amount_minor)::text from public.wallet_entries where wallet_id=w.id),'0') balance_minor,public.refund_holds(w.id)::text held_minor,public.refund_available(w.id)::text available_minor,(select jsonb_build_object('id',p.id,'mode',p.mode,'value',p.value,'agreement',p.agreement) from public.refund_policies p where p.wallet_id=w.id and p.active) policy from public.client_wallets w join public.organizations o on o.id=w.organization_id where w.currency='CNY' and (staff or public.has_finance_access(w.organization_id)) order by o.name limit 500)t),
 'refunds',(select coalesce(jsonb_agg(t),'[]') from (select r.id,r.wallet_id,r.organization_id,o.name company,r.gross_minor::text,r.fee_minor::text,r.net_minor::text,r.policy_snapshot,r.reason,r.status,r.review_note,case when staff then r.assessment end assessment,r.prepared_by=auth.uid() prepared_by_me,r.requested_by=auth.uid() requested_by_me,r.created_at,r.paid_at from public.balance_refunds r join public.organizations o on o.id=r.organization_id where staff or public.has_finance_access(r.organization_id) order by r.created_at desc limit 200)t),
 'payments',(select coalesce(jsonb_agg(t),'[]') from (select x.id,x.kind,x.target_id,x.amount_minor::text,x.paid_on,x.status,x.prepared_by=auth.uid() prepared_by_me,case when staff then x.bank_reference end bank_reference,case when staff then x.payee_reference end payee_reference,case when staff then x.evidence end evidence from public.partner_payments x join public.balance_refunds r on r.id=x.target_id and x.kind='refund' where staff or public.has_finance_access(r.organization_id) order by x.created_at desc limit 200)t));
end $$;
create function public.can_partner_file_path(p_path text,p_write boolean default false) returns boolean language plpgsql security definer set search_path='' as $$
declare a public.partner_agents%rowtype;aid uuid;object_count integer;object_present boolean;begin
 if p_path !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/document\.(pdf|png|jpg)$' then return false;end if;aid:=split_part(p_path,'/',1)::uuid;
 if not public.has_staff_access(array['admin']::text[]) then a:=public.require_partner_agent(true);if aid<>a.id then return false;end if;end if;
 if p_write then
  perform 1 from public.partner_agents where id=aid for update;
  if not found or to_regclass('storage.objects') is null then return false;end if;
  execute 'select count(*),coalesce(bool_or(name=$2),false) from storage.objects where bucket_id=''partner-documents'' and name like $1' into object_count,object_present using aid::text||'/%',p_path;
  return (object_count<200 or (object_count=200 and object_present)) and not exists(select 1 from public.partner_files where object_path=p_path);
 end if;
 return exists(select 1 from public.partner_files where object_path=p_path);
 exception when others then return false;
end $$;
create function public.register_partner_file(p_id uuid,p_agent uuid,p_lead uuid,p_kind text,p_name text,p_path text,p_mime text,p_size integer,p_hash text,p_assignment uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.partner_agents%rowtype;present boolean;begin
 if not public.has_staff_access(array['admin']::text[]) then a:=public.require_partner_agent(true);if p_agent<>a.id then raise exception 'Forbidden' using errcode='42501';end if;end if;
 if not public.can_partner_file_path(p_path,true) or split_part(p_path,'/',1)<>p_agent::text or split_part(p_path,'/',2)<>p_id::text or (p_assignment is not null and not exists(select 1 from public.partner_assignments where id=p_assignment and agent_id=p_agent)) or (p_kind='referral' and p_lead is null and p_assignment is null) or (p_lead is not null and not exists(select 1 from public.partner_leads where id=p_lead and agent_id=p_agent)) then raise exception 'File scope invalid' using errcode='42501';end if;
 if to_regclass('storage.objects') is null then raise exception 'Private storage not configured' using errcode='55000';end if;
 execute 'select exists(select 1 from storage.objects where bucket_id=''partner-documents'' and name=$1)' into present using p_path;
 if not present then raise exception 'Uploaded object missing' using errcode='22023';end if;
 insert into public.partner_files(id,agent_id,lead_id,assignment_id,kind,name,object_path,mime,size_bytes,sha256,uploaded_by) values(p_id,p_agent,p_lead,p_assignment,p_kind,p_name,p_path,p_mime,p_size,p_hash,auth.uid());return p_id;
end $$;
create function public.read_partner_file(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare f public.partner_files%rowtype;begin select * into f from public.partner_files where id=p_id;if not found or not public.can_partner_file_path(f.object_path) then raise exception 'Forbidden' using errcode='42501';end if;return jsonb_build_object('path',f.object_path,'name',f.name);end $$;
-- Storage is present on hosted Supabase. A missing storage schema leaves uploads unavailable, never public.
do $$begin if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('partner-documents','partner-documents',false,4194304,array['application/pdf','image/png','image/jpeg']);
 execute 'create policy partner_document_insert on storage.objects for insert to authenticated with check(bucket_id=''partner-documents'' and public.can_partner_file_path(name,true))';
 execute 'create policy partner_document_read on storage.objects for select to authenticated using(bucket_id=''partner-documents'' and public.can_partner_file_path(name,false))';
 end if;end $$;
-- All helper functions are private; only the explicit command/read/upload boundaries are executable.
do $$declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in ('guard_partner_record_history','require_partner_agent','refund_holds','refund_committed','refund_available','guard_refund_reserved_balance','partner_org_refund_hold','partner_finance_action','read_partner_workspace','read_refund_workspace','can_partner_file_path','register_partner_file','read_partner_file','guard_agent_live') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;end $$;
grant execute on function public.partner_finance_action(text,uuid,jsonb),public.read_partner_workspace(text),public.read_refund_workspace(),public.can_partner_file_path(text,boolean),public.register_partner_file(uuid,uuid,uuid,text,text,text,text,integer,text,uuid),public.read_partner_file(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
