-- Preview upgrade after 062: API-consumption billing; invoices are not a prerequisite.
-- No account authorization, execution flags, balances or published records change.
begin;
create function public.monthly_source_window_ready(p_month date,p_timezone text,p_now timestamptz)
returns boolean language sql stable strict set search_path='' as $$
 select p_now>=(((p_month+interval '1 month')::timestamp at time zone p_timezone)+interval '12 hours')
$$;
revoke all on function public.monthly_source_window_ready(date,text,timestamptz) from public,anon,authenticated,service_role;

create or replace function public.observe_monthly_source(p_job uuid,p_lease uuid,p_report jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.monthly_automation_jobs%rowtype;b public.ads_reporting_bindings%rowtype;last public.monthly_source_observations%rowtype;fp text;n integer;closed_at timestamptz;
begin
 select * into j from public.monthly_automation_jobs where id=p_job for update;
 if j.id is null or j.state<>'running' or j.lease_token is distinct from p_lease or j.lease_until<=now() then raise exception 'Lease expired' using errcode='40001';end if;
 select * into b from public.ads_reporting_bindings where id=j.binding_id;
 closed_at:=((j.month+interval '1 month')::timestamp at time zone (p_report#>>'{account,timezone}'));
 if not public.monthly_source_rows_valid(p_report,j.month) or closed_at is null or not public.monthly_source_window_ready(j.month,p_report#>>'{account,timezone}',now()) or p_report#>>'{account,id}' is distinct from b.account_id or p_report#>>'{account,currency_code}' is distinct from 'CAD'
 or p_report->>'since' is distinct from j.month::text or p_report->>'until' is distinct from (j.month+interval '1 month'-interval '1 day')::date::text
 or p_report->>'check' is distinct from 'matched' or p_report->>'dailySpendMicros' is distinct from p_report->>'periodSpendMicros' or nullif(p_report->>'periodSpendMicros','') is null
 or p_report->'missingDates' is distinct from '[]'::jsonb or jsonb_typeof(p_report->'daily') is distinct from 'array' or jsonb_array_length(p_report->'daily')=0 or coalesce(p_report->>'rawSha256','') !~ '^[a-f0-9]{64}$' then raise exception 'Complete closed source required' using errcode='22023';end if;
 fp:=public.monthly_source_fingerprint(p_report);
 select * into last from public.monthly_source_observations where job_id=j.id order by id desc limit 1;
 if last.id is not null and clock_timestamp()<last.observed_at+interval '12 hours' then
 update public.monthly_automation_jobs set state='retry',attempts=0,available_at=last.observed_at+interval '12 hours',error_code='source_stabilizing',lease_token=null,lease_until=null where id=j.id;
 return jsonb_build_object('state','awaiting_source','jobId',j.id);end if;
 insert into public.monthly_source_observations(job_id,fingerprint,raw_sha256,report) values(j.id,fp,p_report->>'rawSha256',p_report);
 if last.fingerprint=fp and last.observed_at<=clock_timestamp()-interval '12 hours' then
 update public.monthly_automation_jobs set verified_fingerprint=fp,error_code=null where id=j.id;
 return jsonb_build_object('state','stable','jobId',j.id);end if;
 select count(*) into n from public.monthly_source_observations where job_id=j.id;
 update public.monthly_automation_jobs set state=case when n>=5 then 'failed' else 'retry' end,attempts=case when n>=5 then 5 else 0 end,available_at=clock_timestamp()+interval '12 hours',error_code=case when n>=5 then 'source_not_stable' else 'source_stabilizing' end,verified_fingerprint=null,lease_token=null,lease_until=null,updated_at=now() where id=j.id;
 return jsonb_build_object('state',case when n>=5 then 'manual_required' else 'awaiting_source' end,'jobId',j.id,'reason',case when n>=5 then 'source_not_stable' else 'source_stabilizing' end);
end $$;

create or replace function public.claim_monthly_automation(p_account text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.monthly_automation_jobs%rowtype;bound public.ads_reporting_bindings%rowtype;token uuid:=gen_random_uuid();r jsonb;
begin
 -- Grants, rather than forged staff JWTs, authorize the worker.
 insert into public.monthly_automation_jobs(binding_id,month,settings_revision,agreement,authorized_by)
 select b.id,date_trunc('month',now() at time zone s.timezone)::date-interval '1 month',c.revision,c.agreement,c.authorized_by
 from public.monthly_automation_settings c join public.ads_reporting_bindings b on b.id=c.binding_id
 join public.staff_members a on a.user_id=c.authorized_by and a.active and a.role='admin'
 join lateral(select timezone from public.ads_reporting_snapshots where account_id=b.account_id order by created_at desc limit 1)s on true
 where c.enabled and b.active and b.account_id=p_account and public.monthly_source_window_ready((date_trunc('month',now() at time zone s.timezone)::date-interval '1 month')::date,s.timezone,now()) and (c.first_month is null or (date_trunc('month',now() at time zone s.timezone)::date-interval '1 month')::date>=c.first_month) on conflict(binding_id,month) do update set state='pending',settings_revision=excluded.settings_revision,agreement=excluded.agreement,authorized_by=excluded.authorized_by,attempts=0,available_at=now(),error_code=null where public.monthly_automation_jobs.state='cancelled';
 update public.monthly_automation_jobs set state='failed',error_code='attempts_exhausted',lease_token=null,lease_until=null where state='running' and lease_until<now() and attempts>=5;
 select q.* into j from public.monthly_automation_jobs q join public.monthly_automation_settings c on c.binding_id=q.binding_id and c.enabled and c.revision=q.settings_revision
 join public.ads_reporting_bindings b on b.id=q.binding_id and b.active and b.account_id=p_account
 join public.staff_members a on a.user_id=q.authorized_by and a.active and a.role='admin'
 where public.monthly_source_window_ready(q.month,(select timezone from public.ads_reporting_snapshots where account_id=b.account_id order by created_at desc limit 1),now()) and (c.first_month is null or q.month>=c.first_month) and q.attempts<5 and q.available_at<=now() and (q.state in ('pending','retry') or (q.state='running' and q.lease_until<now()))
 order by q.month,q.created_at for update of q skip locked limit 1;
 if not found then return null;end if;
 update public.monthly_automation_jobs set state='running',attempts=attempts+1,lease_token=token,lease_until=now()+interval '5 minutes',updated_at=now() where id=j.id;
 select * into bound from public.ads_reporting_bindings where id=j.binding_id;
 select jsonb_build_object('id',j.id,'bindingId',bound.id,'organizationId',bound.organization_id,'accountId',bound.account_id,'month',to_char(j.month,'YYYY-MM'),'agreement',j.agreement,'leaseToken',token,
 'systemRate',(select to_jsonb(x) from (select revision,organization_id,effective_month,canada_bps,china_bps,transfer_bps from public.monthly_pricing_rates where organization_id is null and effective_month<=j.month order by effective_month desc,revision desc limit 1)x),
 'customerRate',(select to_jsonb(x) from (select revision,organization_id,effective_month,canada_bps,china_bps,transfer_bps from public.monthly_pricing_rates where organization_id=bound.organization_id and effective_month<=j.month order by effective_month desc,revision desc limit 1)x)) into r;
 return r;
end $$;
commit;
