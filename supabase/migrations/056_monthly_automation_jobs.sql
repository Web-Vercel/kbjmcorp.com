-- Explicit opt-in, leased background preparation. No review, publication or ledger rights.
begin;
create table public.monthly_automation_settings (
 binding_id uuid primary key references public.ads_reporting_bindings(id),
 enabled boolean not null default false, agreement text not null check(char_length(btrim(agreement)) between 3 and 1000),
 authorized_by uuid not null references auth.users(id), revision integer not null default 1,
 updated_at timestamptz not null default now()
);
create table public.monthly_automation_jobs (
 id uuid primary key default gen_random_uuid(),binding_id uuid not null references public.ads_reporting_bindings(id),
 month date not null check(extract(day from month)=1),settings_revision integer not null,
 agreement text not null,authorized_by uuid not null references auth.users(id),
 state text not null default 'pending' check(state in ('pending','running','retry','failed','prepared','cancelled')),
 attempts integer not null default 0, available_at timestamptz not null default now(),
 lease_token uuid,lease_until timestamptz,error_code text,
 source_id uuid references public.ads_reporting_snapshots(id),quote_id uuid references public.agency_quote_snapshots(id),draft_id uuid references public.monthly_settlement_drafts(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(binding_id,month)
);
alter table public.monthly_automation_settings enable row level security;
alter table public.monthly_automation_jobs enable row level security;
revoke all on public.monthly_automation_settings,public.monthly_automation_jobs from public,anon,authenticated,service_role;
grant select on public.monthly_automation_settings,public.monthly_automation_jobs to authenticated;
create policy automation_settings_admin on public.monthly_automation_settings for select to authenticated using(public.has_staff_access(array['admin']::text[]));
create policy automation_jobs_admin on public.monthly_automation_jobs for select to authenticated using(public.has_staff_access(array['admin']::text[]));
create function public.configure_monthly_automation(p_binding uuid,p_enabled boolean,p_agreement text) returns integer
language plpgsql security definer set search_path='' as $$
declare v integer;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_agreement is null or char_length(btrim(p_agreement)) not between 3 and 1000 or p_enabled is null then raise exception 'Agreement required' using errcode='22023';end if;
 perform 1 from public.ads_reporting_bindings where id=p_binding and active for update;
 if not found then raise exception 'Active binding required' using errcode='22023';end if;
 insert into public.monthly_automation_settings(binding_id,enabled,agreement,authorized_by) values(p_binding,p_enabled,btrim(p_agreement),auth.uid())
 on conflict(binding_id) do update set enabled=excluded.enabled,agreement=excluded.agreement,authorized_by=excluded.authorized_by,revision=public.monthly_automation_settings.revision+1,updated_at=now() returning revision into v;
 update public.monthly_automation_jobs set state='cancelled',lease_token=null,lease_until=null,updated_at=now() where binding_id=p_binding and state in ('pending','running','retry','failed');
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'monthly_automation_setting',p_binding,'UPDATE',jsonb_build_object('enabled',p_enabled,'revision',v,'no_publication',true));
 return v;
end $$;
create function public.claim_monthly_automation(p_account text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.monthly_automation_jobs%rowtype;bound public.ads_reporting_bindings%rowtype;token uuid:=gen_random_uuid();r jsonb;
begin
 -- Grants, rather than forged staff JWTs, authorize the worker.
 insert into public.monthly_automation_jobs(binding_id,month,settings_revision,agreement,authorized_by)
 select b.id,date_trunc('month',now() at time zone s.timezone)::date-interval '1 month',c.revision,c.agreement,c.authorized_by
 from public.monthly_automation_settings c join public.ads_reporting_bindings b on b.id=c.binding_id
 join public.staff_members a on a.user_id=c.authorized_by and a.active and a.role='admin'
 join lateral(select timezone from public.ads_reporting_snapshots where account_id=b.account_id order by created_at desc limit 1)s on true
 where c.enabled and b.active and b.account_id=p_account on conflict(binding_id,month) do update set state='pending',settings_revision=excluded.settings_revision,agreement=excluded.agreement,authorized_by=excluded.authorized_by,attempts=0,available_at=now(),error_code=null where public.monthly_automation_jobs.state='cancelled';
 update public.monthly_automation_jobs set state='failed',error_code='attempts_exhausted',lease_token=null,lease_until=null where state='running' and lease_until<now() and attempts>=5;
 select q.* into j from public.monthly_automation_jobs q join public.monthly_automation_settings c on c.binding_id=q.binding_id and c.enabled and c.revision=q.settings_revision
 join public.ads_reporting_bindings b on b.id=q.binding_id and b.active and b.account_id=p_account
 join public.staff_members a on a.user_id=q.authorized_by and a.active and a.role='admin'
 where q.attempts<5 and q.available_at<=now() and (q.state in ('pending','retry') or (q.state='running' and q.lease_until<now()))
 order by q.month,q.created_at for update of q skip locked limit 1;
 if not found then return null;end if;
 update public.monthly_automation_jobs set state='running',attempts=attempts+1,lease_token=token,lease_until=now()+interval '5 minutes',updated_at=now() where id=j.id;
 select * into bound from public.ads_reporting_bindings where id=j.binding_id;
 select jsonb_build_object('id',j.id,'bindingId',bound.id,'organizationId',bound.organization_id,'accountId',bound.account_id,'month',to_char(j.month,'YYYY-MM'),'agreement',j.agreement,'leaseToken',token,
 'systemRate',(select to_jsonb(x) from (select revision,organization_id,effective_month,canada_bps,china_bps,transfer_bps from public.monthly_pricing_rates where organization_id is null and effective_month<=j.month order by effective_month desc,revision desc limit 1)x),
 'customerRate',(select to_jsonb(x) from (select revision,organization_id,effective_month,canada_bps,china_bps,transfer_bps from public.monthly_pricing_rates where organization_id=bound.organization_id and effective_month<=j.month order by effective_month desc,revision desc limit 1)x)) into r;
 return r;
end $$;
create function public.fail_monthly_automation(p_job uuid,p_lease uuid,p_code text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_code not in ('source_unavailable','source_not_ready','reference_unavailable','scope_conflict','storage_unavailable') then raise exception 'Invalid error code' using errcode='22023';end if;
 update public.monthly_automation_jobs set state=case when attempts>=5 then 'failed' else 'retry' end,error_code=p_code,available_at=now()+make_interval(mins=>15*(2^least(attempts,5))::integer),lease_token=null,lease_until=null,updated_at=now()
 where id=p_job and state='running' and lease_token=p_lease and lease_until>now();
 return found;
end $$;
create function public.complete_monthly_automation(p_job uuid,p_lease uuid,p_report jsonb,p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.monthly_automation_jobs%rowtype;b public.ads_reporting_bindings%rowtype;c public.monthly_automation_settings%rowtype;sid uuid;qid uuid;did uuid;resolved jsonb;cad bigint;rev integer;
begin
 select * into j from public.monthly_automation_jobs where id=p_job for update;
 if not found or j.state<>'running' or j.lease_token is distinct from p_lease or j.lease_until<=now() then raise exception 'Lease expired' using errcode='40001';end if;
 select * into c from public.monthly_automation_settings where binding_id=j.binding_id for share;
 select * into b from public.ads_reporting_bindings where id=j.binding_id for update;
 if not c.enabled or c.revision<>j.settings_revision or not b.active or not exists(select 1 from public.staff_members where user_id=j.authorized_by and active and role='admin') then raise exception 'Automation paused' using errcode='42501';end if;
 if exists(select 1 from public.monthly_settlement_drafts where binding_id=b.id and month=j.month) or exists(select 1 from public.monthly_client_statements where binding_id=b.id and month=j.month) or exists(select 1 from public.monthly_ad_reports where ad_account_id=b.ad_account_id and month=j.month and published_at is not null) then raise exception 'Existing draft requires investigation' using errcode='40001';end if;
 if p_report->>'version' is distinct from 'ads-readonly-v1' or p_report#>>'{account,id}' is distinct from b.account_id or p_report#>>'{account,currency_code}' is distinct from 'CAD'
 or p_report->>'since' is distinct from j.month::text or p_report->>'until' is distinct from (j.month+interval '1 month'-interval '1 day')::date::text
 or coalesce(p_report->>'rawSha256','') !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_report->'rawResponses') is distinct from 'array' then raise exception 'Source mismatch' using errcode='22023';end if;
 insert into public.ads_reporting_snapshots(request_id,account_id,account_name,currency,timezone,since,until,check_status,daily_spend_micros,period_spend_micros,report,created_by)
 values(j.id,b.account_id,p_report#>>'{account,name}','CAD',p_report#>>'{account,timezone}',j.month,(p_report->>'until')::date,p_report->>'check',(p_report->>'dailySpendMicros')::numeric,(p_report->>'periodSpendMicros')::numeric,p_report,j.authorized_by) returning id into sid;
 resolved:=public.resolve_ads_month(sid);
 if resolved->>'ready' is distinct from 'true' then raise exception 'Incomplete source' using errcode='23514';end if;
 cad:=round((resolved->>'amount_micros')::numeric/10000,0)::bigint;
 if p_snapshot->>'calculationVersion' is distinct from 'two-agency-v1' or p_snapshot->>'status' is distinct from 'draft' or p_snapshot->>'rateMode' is distinct from 'automatic'
 or p_snapshot->>'sourceCadMinor' is distinct from cad::text or coalesce(p_snapshot->>'finalMinor','') !~ '^[0-9]{1,18}$'
 or p_snapshot#>>'{referenceProof,billingMonth}' is distinct from to_char(j.month,'YYYY-MM') or p_snapshot#>>'{referenceProof,policy}' is distinct from 'month_end_last_published'
 or p_snapshot#>>'{automation,bindingId}' is distinct from b.id::text or p_snapshot#>>'{automation,agreement}' is distinct from j.agreement then raise exception 'Quote mismatch' using errcode='22023';end if;
 -- Pin the actual immutable source ID, not a worker-generated placeholder.
 p_snapshot:=jsonb_set(p_snapshot,'{automation,sourceId}',to_jsonb(sid::text));
 insert into public.ads_source_handoffs(snapshot_id,binding_id,note,shared_by) values(sid,b.id,'Automatic monthly source; no customer publication.',j.authorized_by);
 perform pg_advisory_xact_lock(hashtextextended(b.organization_id::text||j.month::text,0));
 select coalesce(max(revision),0)+1 into rev from public.agency_quote_snapshots where organization_id=b.organization_id and period=j.month;
 insert into public.agency_quote_snapshots(organization_id,period,revision,request_id,request_fingerprint,private_snapshot,created_by)
 values(b.organization_id,j.month,rev,j.id,encode(sha256(convert_to(p_snapshot::text,'UTF8')),'hex'),p_snapshot,j.authorized_by) returning id into qid;
 insert into public.monthly_settlement_drafts(organization_id,binding_id,snapshot_id,quote_id,month,source_cad_minor,total_cny_minor,agreement_reference,note,prepared_by,coverage_kind,coverage_check_id)
 values(b.organization_id,b.id,sid,qid,j.month,cad,(p_snapshot->>'finalMinor')::bigint,j.agreement,'Automated preparation; independent review required.',j.authorized_by,resolved->>'coverage_kind',(resolved->>'coverage_check_id')::uuid) returning id into did;
 update public.monthly_automation_jobs set state='prepared',source_id=sid,quote_id=qid,draft_id=did,lease_token=null,lease_until=null,error_code=null,updated_at=now() where id=j.id;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(j.authorized_by,'monthly_automation_job',j.id,'INSERT',jsonb_build_object('execution','background_worker','authorizing_admin',j.authorized_by,'draft_id',did,'no_publication',true,'no_ledger_posting',true));
 return jsonb_build_object('draftId',did,'quoteId',qid,'sourceId',sid);
end $$;
revoke all on function public.configure_monthly_automation(uuid,boolean,text),public.claim_monthly_automation(text),public.fail_monthly_automation(uuid,uuid,text),public.complete_monthly_automation(uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.configure_monthly_automation(uuid,boolean,text) to authenticated;
grant execute on function public.claim_monthly_automation(text),public.fail_monthly_automation(uuid,uuid,text),public.complete_monthly_automation(uuid,uuid,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
