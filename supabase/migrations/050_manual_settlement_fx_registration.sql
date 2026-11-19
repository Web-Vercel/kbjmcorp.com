-- Administrator-confirmed reference rates for existing manual reconciliation.
-- Does not publish statements, change balances, or weaken independent review.
begin;
create function public.register_ops_fx_reference(p_id uuid,p_rate text,p_reference_date date,p_source text) returns uuid
language plpgsql security definer set search_path='' as $$
declare existing public.billing_fx_quotes%rowtype; day date:=(now() at time zone 'Asia/Shanghai')::date; label text;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_id is null or p_rate is null or p_rate !~ '^[0-9]{1,6}(\.[0-9]{1,8})?$' then raise exception 'Invalid rate' using errcode='22023';end if;
 if p_rate::numeric<=0 or p_reference_date is null or p_reference_date>day or p_reference_date<day-7 or p_source is distinct from 'Bank of Canada' then raise exception 'Invalid reference' using errcode='22023';end if;
 label:='Bank of Canada FXCNYCAD · reference '||p_reference_date::text;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,50));
 select * into existing from public.billing_fx_quotes where id=p_id;
 if found then
  if existing.cad_cny_rate<>p_rate or existing.source_name<>label or existing.value_date<>day or existing.is_demo then raise exception 'Request changed' using errcode='40001';end if;
  return existing.id;
 end if;
 insert into public.billing_fx_quotes(id,cad_cny_rate,value_date,quoted_at,source_name,is_demo) values(p_id,p_rate,day,now(),label,false);
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'billing_fx_quote',p_id,'INSERT',jsonb_build_object('source',label,'value_date',day));
 return p_id;
end;
$$;
revoke all on function public.register_ops_fx_reference(uuid,text,date,text) from public,anon;
grant execute on function public.register_ops_fx_reference(uuid,text,date,text) to authenticated;
commit;
