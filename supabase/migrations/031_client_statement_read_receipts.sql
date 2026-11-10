-- Client-declared reading acknowledgement only; never accepts pricing or posts money.
begin;
create table public.client_statement_read_receipts(
 statement_id uuid not null references public.monthly_client_statements(id),user_id uuid not null references auth.users(id),
 confirmed_at timestamptz not null default now(),primary key(statement_id,user_id)
);
alter table public.client_statement_read_receipts enable row level security;
revoke all on public.client_statement_read_receipts from public,anon,authenticated;
create trigger immutable_client_statement_read before update or delete on public.client_statement_read_receipts for each row execute function public.lock_posted_money();
create function public.confirm_client_statement_read(p_statement uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result timestamptz;org uuid;
begin
 if auth.uid() is null or exists(select 1 from public.staff_members where user_id=auth.uid()) then raise exception 'Client account required' using errcode='42501';end if;
 select organization_id into org from public.monthly_client_statements where id=p_statement;
 if not found or not public.has_finance_access(org) then raise exception 'Forbidden' using errcode='42501';end if;
 insert into public.client_statement_read_receipts(statement_id,user_id) values(p_statement,auth.uid()) on conflict do nothing returning confirmed_at into result;
 if found then
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'client_statement_read',p_statement,'INSERT',jsonb_build_object('statement_id',p_statement));
 else select confirmed_at into result from public.client_statement_read_receipts where statement_id=p_statement and user_id=auth.uid();end if;
 return jsonb_build_object('statement_id',p_statement,'confirmed_at',result);
end $$;
create function public.get_client_statement_read_receipts(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or exists(select 1 from public.staff_members where user_id=auth.uid()) then raise exception 'Client account required' using errcode='42501';end if;
 if p_ids is null or cardinality(p_ids)>100 then raise exception 'Statement limit' using errcode='22023';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('statement_id',r.statement_id,'confirmed_at',r.confirmed_at) order by r.confirmed_at desc)
 from public.client_statement_read_receipts r join public.monthly_client_statements s on s.id=r.statement_id where r.user_id=auth.uid() and r.statement_id=any(p_ids) and public.has_finance_access(s.organization_id)),'[]'::jsonb);
end $$;
create function public.get_statement_read_status(p_org uuid,p_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare n integer;rows jsonb;
begin
 if p_org is null or not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_month is null or not isfinite(p_month) or extract(day from p_month)<>1 then raise exception 'Month must start on day one' using errcode='22023';end if;
 select count(*) into n from public.monthly_client_statements where organization_id=p_org and month=p_month;
 select coalesce(jsonb_agg(jsonb_build_object('statement_id',s.id,'confirmation_count',(select count(*) from public.client_statement_read_receipts r where r.statement_id=s.id),'last_confirmed_at',(select max(confirmed_at) from public.client_statement_read_receipts r where r.statement_id=s.id)) order by s.published_at desc,s.id desc),'[]'::jsonb) into rows
 from (select id,published_at from public.monthly_client_statements where organization_id=p_org and month=p_month order by published_at desc,id desc limit 200)s;
 return jsonb_build_object('statement_count',n,'statements',rows);
end $$;
revoke all on function public.confirm_client_statement_read(uuid),public.get_client_statement_read_receipts(uuid[]),public.get_statement_read_status(uuid,date) from public,anon;
grant execute on function public.confirm_client_statement_read(uuid),public.get_client_statement_read_receipts(uuid[]),public.get_statement_read_status(uuid,date) to authenticated;
notify pgrst,'reload schema';
commit;
