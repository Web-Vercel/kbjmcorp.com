-- Append-only commercial rule drafts. Not agreed prices; no billing or wallet writes.
begin;
create table public.agency_fee_rule_drafts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 unit_code text not null check(unit_code in ('kbjm_ca','zhidian_cn')),
 currency text generated always as(case when unit_code='kbjm_ca' then 'CAD' else 'CNY' end) stored,
 revision integer not null check(revision>0), effective_month date not null check(extract(day from effective_month)=1),
 mode text not null check(mode in ('percentage','fixed','greater_of')),
 basis text not null check(basis in ('platform_ad_spend','upstream_total')),
 basis_points integer not null check(basis_points between 0 and 10000),
 fixed_minor bigint not null check(fixed_minor between 0 and 9999999999),
 minimum_minor bigint not null check(minimum_minor between 0 and 9999999999),
 waive_when_zero boolean not null default true,
 note text not null check(char_length(btrim(note)) between 3 and 1000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 check(unit_code<>'kbjm_ca' or basis='platform_ad_spend'),
 unique(organization_id,unit_code,revision)
);
alter table public.agency_fee_rule_drafts enable row level security;
revoke all on public.agency_fee_rule_drafts from public,anon,authenticated;
grant select on public.agency_fee_rule_drafts to authenticated;
create policy finance_fee_drafts on public.agency_fee_rule_drafts for select to authenticated using(public.has_ops_capability('finance.read',organization_id));
create trigger immutable_fee_draft before update or delete on public.agency_fee_rule_drafts for each row execute function public.lock_posted_money();
create function public.save_agency_fee_draft(p_org uuid,p_unit text,p_month date,p_mode text,p_basis text,p_bps integer,p_fixed bigint,p_minimum bigint,p_waive boolean,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; revision integer;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.organizations where id=p_org for update;
 if not found then raise exception 'Company unavailable' using errcode='22023'; end if;
 select coalesce(max(d.revision),0)+1 into revision from public.agency_fee_rule_drafts d where d.organization_id=p_org and d.unit_code=p_unit;
 insert into public.agency_fee_rule_drafts(organization_id,unit_code,revision,effective_month,mode,basis,basis_points,fixed_minor,minimum_minor,waive_when_zero,note,created_by)
 values(p_org,p_unit,revision,p_month,p_mode,p_basis,p_bps,p_fixed,p_minimum,p_waive,btrim(p_note),auth.uid()) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'agency_fee_draft',result,'INSERT',jsonb_build_object('organization_id',p_org,'unit',p_unit,'revision',revision,'draft_only',true));
 return result;
end $$;
revoke all on function public.save_agency_fee_draft(uuid,text,date,text,text,integer,bigint,bigint,boolean,text) from public,anon;
grant execute on function public.save_agency_fee_draft(uuid,text,date,text,text,integer,bigint,bigint,boolean,text) to authenticated;
commit;
