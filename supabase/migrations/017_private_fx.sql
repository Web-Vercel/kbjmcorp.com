-- Internal FX confidentiality. Does not change stored rates, reports or money.
begin;
drop policy if exists report_fx_quote on public.billing_fx_quotes;
drop policy if exists finance_rate_sources on public.billing_fx_quotes;
create policy admin_only_fx on public.billing_fx_quotes for select to authenticated using(public.has_staff_access(array['admin']::text[]));
create or replace function public.prepare_ops_reconciliation(p_packet uuid,p_quote uuid,p_fee_bps integer,p_fee_reference text) returns uuid language plpgsql security definer set search_path='' as $$
declare packet public.ops_source_packets%rowtype; quote public.billing_fx_quotes%rowtype; result uuid; next_revision integer; converted numeric;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Administrator required for private FX' using errcode='42501'; end if;
 select * into packet from public.ops_source_packets where id=p_packet;
 if not found or not public.has_ops_capability('finance.prepare',packet.organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.ad_accounts where id=packet.ad_account_id for update;
 select * into packet from public.ops_source_packets where id=p_packet for update;
 if exists(select 1 from public.ops_source_packets where ad_account_id=packet.ad_account_id and period=packet.period and version>packet.version) or packet.status not in ('submitted','under_review') then raise exception 'Stale or returned source' using errcode='40001'; end if;
 if packet.source_currency<>'CAD' then raise exception 'Verified CAD to CNY adapter required' using errcode='22023'; end if;
 select * into quote from public.billing_fx_quotes where id=p_quote;
 if not found or quote.is_demo or quote.value_date<>(now() at time zone 'Asia/Shanghai')::date or (quote.quoted_at at time zone 'Asia/Shanghai')::date<>quote.value_date or quote.quoted_at>now() then raise exception 'Current verified quote required' using errcode='22023'; end if;
 if p_fee_bps is null or p_fee_bps not between 0 and 10000 or (p_fee_bps>0 and char_length(btrim(coalesce(p_fee_reference,'')))<3) then raise exception 'Agreed fee evidence required' using errcode='22023'; end if;
 if exists(select 1 from public.ops_reconciliations where packet_id=p_packet and status in ('pending','approved')) then raise exception 'Financial review already exists' using errcode='40001'; end if;
 select coalesce(max(revision),0)+1 into next_revision from public.ops_reconciliations where packet_id=p_packet;
 converted:=round(packet.source_amount_minor::numeric*quote.cad_cny_rate::numeric,0);
 insert into public.ops_reconciliations(packet_id,revision,fx_quote_id,settlement_date,ad_spend_cny_minor,fee_minor,fee_basis_points,fee_agreement_reference,prepared_by) values(p_packet,next_revision,p_quote,quote.value_date,converted,round(converted*p_fee_bps/10000,0),p_fee_bps,nullif(btrim(p_fee_reference),''),auth.uid()) returning id into result;
 update public.ops_source_packets set status='under_review' where id=p_packet;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'ops_reconciliation',result,'INSERT',jsonb_build_object('packet_id',p_packet,'revision',next_revision));
 return result;
end;
$$;

-- Authorize and validate the customer's published statement without returning the rate.
create function public.validate_client_statement(p_report uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare r public.monthly_ad_reports%rowtype; q public.billing_fx_quotes%rowtype; principal numeric;
begin
 select * into r from public.monthly_ad_reports where id=p_report and published_at is not null and public.has_finance_access(organization_id);
 if not found then return false; end if;
 if r.currency<>'CNY' then return true; end if;
 select * into q from public.billing_fx_quotes where id=r.fx_quote_id;
 if not found or q.is_demo or r.source_currency is distinct from 'CAD' or r.source_ad_spend_minor is null then return false; end if;
 if q.value_date is distinct from r.settlement_date or (q.quoted_at at time zone 'Asia/Shanghai')::date is distinct from r.settlement_date or (r.published_at at time zone 'Asia/Shanghai')::date is distinct from r.settlement_date or r.published_at<q.quoted_at then return false; end if;
 principal:=round(r.source_ad_spend_minor::numeric*q.cad_cny_rate::numeric,0);
 if r.ad_spend_minor<>principal or r.service_fee_minor<>round(principal*r.fee_basis_points/10000,0) or (r.fee_basis_points>0 and nullif(btrim(r.fee_agreement_reference),'') is null) then return false; end if;
 if not exists(select 1 from public.monthly_ad_report_lines where report_id=r.id) or exists(select 1 from public.monthly_ad_report_lines where report_id=r.id and source_cad_minor is null) then return false; end if;
 return (select sum(source_cad_minor)=r.source_ad_spend_minor and sum(spend_minor)=r.ad_spend_minor from public.monthly_ad_report_lines where report_id=r.id);
end $$;
revoke all on function public.validate_client_statement(uuid) from public,anon;
grant execute on function public.validate_client_statement(uuid) to authenticated;
commit;
