-- Read-only procurement reconciliation from posted statements and pinned quotes.
-- No payable recognition, payment registration or customer wallet mutation.
begin;
create function public.get_upstream_reconciliation(p_month date,p_org uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;totals jsonb;n bigint;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_month is null or extract(day from p_month)<>1 then raise exception 'Month must start on day one' using errcode='22023';end if;
 if p_org is not null and not exists(select 1 from public.organizations where id=p_org) then raise exception 'Unknown organization' using errcode='22023';end if;
 -- Never silently omit or treat an invalid historical monetary value as zero.
 if exists(select 1 from public.monthly_client_statements s join public.monthly_settlement_drafts d on d.id=s.draft_id join public.agency_quote_snapshots q on q.id=d.quote_id
 where s.month=p_month and (p_org is null or s.organization_id=p_org) and (
 exists(select 1 from unnest(array['sourceCadMinor','canadaFeeCadMinor','upstreamCadMinor','upstreamCnyMinor','chinaFeeCnyMinor','customerCostMinor','agencyCostMinor','finalMinor']) k where coalesce(q.private_snapshot->>k,'') !~ '^[0-9]{1,20}$')
 )) then raise exception 'Procurement quote invalid' using errcode='23514';end if;
 if exists(select 1 from public.monthly_client_statements s join public.monthly_settlement_drafts d on d.id=s.draft_id join public.agency_quote_snapshots q on q.id=d.quote_id
 where s.month=p_month and (p_org is null or s.organization_id=p_org) and (
 (q.private_snapshot->>'sourceCadMinor')::numeric+(q.private_snapshot->>'canadaFeeCadMinor')::numeric<>(q.private_snapshot->>'upstreamCadMinor')::numeric
 or (q.private_snapshot->>'upstreamCnyMinor')::numeric<>s.upstream_cny_minor
 or (q.private_snapshot->>'chinaFeeCnyMinor')::numeric+(q.private_snapshot->>'customerCostMinor')::numeric<>s.service_cny_minor
 or (q.private_snapshot->>'finalMinor')::numeric<>s.total_cny_minor
 )) then raise exception 'Procurement quote differs from posted statement' using errcode='23514';end if;
 with source as (
 select s.id statement_id,s.organization_id,o.name organization_name,s.month,s.published_at,s.usage->>'account_name' account_name,q.id quote_id,q.revision quote_revision,
 (q.private_snapshot->>'sourceCadMinor')::numeric source_cad_minor,(q.private_snapshot->>'canadaFeeCadMinor')::numeric canada_fee_cad_minor,(q.private_snapshot->>'upstreamCadMinor')::numeric procurement_cad_minor,
 s.upstream_cny_minor procurement_cny_minor,(q.private_snapshot->>'chinaFeeCnyMinor')::numeric china_fee_cny_minor,(q.private_snapshot->>'customerCostMinor')::numeric customer_transfer_cny_minor,(q.private_snapshot->>'agencyCostMinor')::numeric agency_transfer_cny_minor,
 s.total_cny_minor customer_charged_cny_minor
 from public.monthly_client_statements s join public.organizations o on o.id=s.organization_id join public.monthly_settlement_drafts d on d.id=s.draft_id join public.agency_quote_snapshots q on q.id=d.quote_id
 where s.month=p_month and (p_org is null or s.organization_id=p_org)
 ),limited as (select * from source order by published_at desc,statement_id desc limit 200)
 select (select count(*) from source),
 (select jsonb_build_object('source_cad_minor',coalesce(sum(source_cad_minor),0)::text,'canada_fee_cad_minor',coalesce(sum(canada_fee_cad_minor),0)::text,'procurement_cad_minor',coalesce(sum(procurement_cad_minor),0)::text,
 'procurement_cny_minor',coalesce(sum(procurement_cny_minor),0)::text,'china_fee_cny_minor',coalesce(sum(china_fee_cny_minor),0)::text,'customer_transfer_cny_minor',coalesce(sum(customer_transfer_cny_minor),0)::text,'agency_transfer_cny_minor',coalesce(sum(agency_transfer_cny_minor),0)::text,'customer_charged_cny_minor',coalesce(sum(customer_charged_cny_minor),0)::text) from source),
 coalesce((select jsonb_agg(jsonb_build_object('statement_id',statement_id,'organization_id',organization_id,'organization_name',organization_name,'month',month,'published_at',published_at,'account_name',account_name,'quote_id',quote_id,'quote_revision',quote_revision,
 'source_cad_minor',source_cad_minor::text,'canada_fee_cad_minor',canada_fee_cad_minor::text,'procurement_cad_minor',procurement_cad_minor::text,'procurement_cny_minor',procurement_cny_minor::text,'china_fee_cny_minor',china_fee_cny_minor::text,'customer_transfer_cny_minor',customer_transfer_cny_minor::text,'agency_transfer_cny_minor',agency_transfer_cny_minor::text,'customer_charged_cny_minor',customer_charged_cny_minor::text) order by published_at desc,statement_id desc) from limited),'[]'::jsonb)
 into n,totals,rows;
 return jsonb_build_object('month',p_month,'organization_id',p_org,'row_count',n,'truncated',n>200,'totals',totals,'rows',rows,'payment_status','not_tracked');
end $$;
revoke all on function public.get_upstream_reconciliation(date,uuid) from public,anon;
grant execute on function public.get_upstream_reconciliation(date,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
