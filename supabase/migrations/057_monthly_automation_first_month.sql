-- Preview: a lower bound on automatic consumption months; no backfill or automatic opt-in.
begin;
alter table public.monthly_automation_settings add column first_month date
 check(first_month is null or (isfinite(first_month) and extract(day from first_month)=1));
-- NULL retains the historical behavior of existing settings. New settings require a first month.
create function public.configure_monthly_automation(p_binding uuid,p_enabled boolean,p_agreement text,p_first_month date) returns integer
language plpgsql security definer set search_path='' as $$
declare v integer;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_agreement is null or char_length(btrim(p_agreement)) not between 3 and 1000 or p_enabled is null then raise exception 'Agreement required' using errcode='22023';end if;
 if p_first_month is not null and (not isfinite(p_first_month) or extract(day from p_first_month)<>1) then raise exception 'Invalid first month' using errcode='22023';end if;
 perform 1 from public.ads_reporting_bindings where id=p_binding and active for update;
 if not found then raise exception 'Active binding required' using errcode='22023';end if;
 if p_first_month is null and not exists(select 1 from public.monthly_automation_settings where binding_id=p_binding and first_month is null) then raise exception 'First month required' using errcode='22023';end if;
 insert into public.monthly_automation_settings(binding_id,enabled,agreement,authorized_by,first_month) values(p_binding,p_enabled,btrim(p_agreement),auth.uid(),p_first_month)
 on conflict(binding_id) do update set enabled=excluded.enabled,agreement=excluded.agreement,first_month=excluded.first_month,authorized_by=excluded.authorized_by,revision=public.monthly_automation_settings.revision+1,updated_at=now() returning revision into v;
 update public.monthly_automation_jobs set state='cancelled',lease_token=null,lease_until=null,updated_at=now() where binding_id=p_binding and state in ('pending','running','retry','failed');
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'monthly_automation_setting',p_binding,'UPDATE',jsonb_build_object('enabled',p_enabled,'revision',v,'first_month',p_first_month,'no_publication',true));
 return v;
end $$;
create or replace function public.configure_monthly_automation(p_binding uuid,p_enabled boolean,p_agreement text) returns integer
language plpgsql security definer set search_path='' as $$
declare first_date date;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501';end if;
 perform 1 from public.ads_reporting_bindings where id=p_binding for update;
 select first_month into first_date from public.monthly_automation_settings where binding_id=p_binding;
 return public.configure_monthly_automation(p_binding,p_enabled,p_agreement,first_date);
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
 where c.enabled and b.active and b.account_id=p_account and (c.first_month is null or (date_trunc('month',now() at time zone s.timezone)::date-interval '1 month')::date>=c.first_month) on conflict(binding_id,month) do update set state='pending',settings_revision=excluded.settings_revision,agreement=excluded.agreement,authorized_by=excluded.authorized_by,attempts=0,available_at=now(),error_code=null where public.monthly_automation_jobs.state='cancelled';
 update public.monthly_automation_jobs set state='failed',error_code='attempts_exhausted',lease_token=null,lease_until=null where state='running' and lease_until<now() and attempts>=5;
 select q.* into j from public.monthly_automation_jobs q join public.monthly_automation_settings c on c.binding_id=q.binding_id and c.enabled and c.revision=q.settings_revision
 join public.ads_reporting_bindings b on b.id=q.binding_id and b.active and b.account_id=p_account
 join public.staff_members a on a.user_id=q.authorized_by and a.active and a.role='admin'
 where (c.first_month is null or q.month>=c.first_month) and q.attempts<5 and q.available_at<=now() and (q.state in ('pending','retry') or (q.state='running' and q.lease_until<now()))
 order by q.month,q.created_at for update of q skip locked limit 1;
 if not found then return null;end if;
 update public.monthly_automation_jobs set state='running',attempts=attempts+1,lease_token=token,lease_until=now()+interval '5 minutes',updated_at=now() where id=j.id;
 select * into bound from public.ads_reporting_bindings where id=j.binding_id;
 select jsonb_build_object('id',j.id,'bindingId',bound.id,'organizationId',bound.organization_id,'accountId',bound.account_id,'month',to_char(j.month,'YYYY-MM'),'agreement',j.agreement,'leaseToken',token,
 'systemRate',(select to_jsonb(x) from (select revision,organization_id,effective_month,canada_bps,china_bps,transfer_bps from public.monthly_pricing_rates where organization_id is null and effective_month<=j.month order by effective_month desc,revision desc limit 1)x),
 'customerRate',(select to_jsonb(x) from (select revision,organization_id,effective_month,canada_bps,china_bps,transfer_bps from public.monthly_pricing_rates where organization_id=bound.organization_id and effective_month<=j.month order by effective_month desc,revision desc limit 1)x)) into r;
 return r;
end $$;
revoke all on function public.configure_monthly_automation(uuid,boolean,text,date) from public,anon,authenticated,service_role;
grant execute on function public.configure_monthly_automation(uuid,boolean,text,date) to authenticated;
notify pgrst,'reload schema';
commit;
