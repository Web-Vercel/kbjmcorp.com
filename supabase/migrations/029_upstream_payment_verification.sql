-- Verify offline CAD receipts and allocate them to posted procurement; never debit wallets.
begin;
create table public.upstream_payment_records(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,organization_id uuid not null references public.organizations(id),
 revision integer not null check(revision>0),bank_reference text not null check(bank_reference=upper(bank_reference) and bank_reference ~ '^[A-Z0-9][A-Z0-9._:/-]{2,159}$'),
 received_on date not null check(isfinite(received_on)),received_cad_minor bigint not null check(received_cad_minor between 1 and 9999999999),
 evidence_reference text not null check(char_length(btrim(evidence_reference)) between 3 and 1000),evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 note text not null check(char_length(btrim(note)) between 3 and 1000),allocations jsonb not null check(jsonb_typeof(allocations)='array'),
 prepared_by uuid not null references auth.users(id),prepared_at timestamptz not null default now(),unique(bank_reference,revision)
);
create table public.upstream_payment_allocations(
 payment_id uuid not null references public.upstream_payment_records(id),statement_id uuid not null references public.monthly_client_statements(id),
 amount_cad_minor bigint not null check(amount_cad_minor between 1 and 9999999999),primary key(payment_id,statement_id)
);
create index upstream_allocations_statement on public.upstream_payment_allocations(statement_id);
create table public.upstream_payment_reviews(
 payment_id uuid primary key references public.upstream_payment_records(id),decision text not null check(decision in ('approved','rejected')),
 reviewed_by uuid not null references auth.users(id),note text not null check(char_length(btrim(note)) between 3 and 1000),reviewed_at timestamptz not null default now()
);
alter table public.upstream_payment_records enable row level security;
alter table public.upstream_payment_allocations enable row level security;
alter table public.upstream_payment_reviews enable row level security;
revoke all on public.upstream_payment_records,public.upstream_payment_allocations,public.upstream_payment_reviews from public,anon,authenticated;
create trigger immutable_upstream_payment before update or delete on public.upstream_payment_records for each row execute function public.lock_posted_money();
create trigger immutable_upstream_allocation before update or delete on public.upstream_payment_allocations for each row execute function public.lock_posted_money();
create trigger immutable_upstream_review before update or delete on public.upstream_payment_reviews for each row execute function public.lock_posted_money();
create function public.verify_upstream_allocations() returns trigger language plpgsql security definer set search_path='' as $$
declare p uuid;expected bigint;actual numeric;
begin
 if TG_TABLE_NAME='upstream_payment_records' then p:=NEW.id;else p:=NEW.payment_id;end if;
 select received_cad_minor into expected from public.upstream_payment_records where id=p;
 select coalesce(sum(amount_cad_minor),0) into actual from public.upstream_payment_allocations where payment_id=p;
 if exists(select 1 from public.upstream_payment_allocations a join public.upstream_payment_records h on h.id=a.payment_id join public.monthly_client_statements s on s.id=a.statement_id where a.payment_id=p and h.organization_id<>s.organization_id) then raise exception 'Receipt organization mismatch' using errcode='23514';end if;
 if actual<>expected then raise exception 'Receipt allocation incomplete' using errcode='23514';end if;
 return NEW;
end $$;
revoke all on function public.verify_upstream_allocations() from public,anon,authenticated;
create constraint trigger complete_upstream_payment after insert on public.upstream_payment_records deferrable initially deferred for each row execute function public.verify_upstream_allocations();
create constraint trigger complete_upstream_allocation after insert on public.upstream_payment_allocations deferrable initially deferred for each row execute function public.verify_upstream_allocations();
create function public.upstream_statement_amount(p_statement uuid) returns bigint language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 select q.private_snapshot into v from public.monthly_client_statements s join public.monthly_settlement_drafts d on d.id=s.draft_id join public.agency_quote_snapshots q on q.id=d.quote_id where s.id=p_statement;
 if not found or exists(select 1 from unnest(array['sourceCadMinor','canadaFeeCadMinor','upstreamCadMinor']) k where coalesce(v->>k,'') !~ '^[0-9]{1,20}$') then raise exception 'Procurement quote invalid' using errcode='23514';end if;
 if (v->>'sourceCadMinor')::numeric+(v->>'canadaFeeCadMinor')::numeric<>(v->>'upstreamCadMinor')::numeric then raise exception 'Procurement amount mismatch' using errcode='23514';end if;
 return (v->>'upstreamCadMinor')::bigint;
end $$;
revoke all on function public.upstream_statement_amount(uuid) from public,anon,authenticated;
create function public.submit_upstream_payment(p_request uuid,p_org uuid,p_reference text,p_received_on date,p_received text,p_evidence text,p_hash text,p_note text,p_allocations jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare prior public.upstream_payment_records%rowtype;item jsonb;s public.monthly_client_statements%rowtype;result uuid;total numeric:=0;ref text;latest public.upstream_payment_records%rowtype;rev integer:=1;
begin
 if p_org is null or not public.has_ops_capability('finance.prepare',p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 ref:=upper(btrim(p_reference));
 if p_request is null or ref is null or ref !~ '^[A-Z0-9][A-Z0-9._:/-]{2,159}$' or p_received_on is null or not isfinite(p_received_on) or p_received_on>(now() at time zone 'America/Vancouver')::date
 or p_received is null or p_received !~ '^[0-9]{1,10}$' or p_received::numeric not between 1 and 9999999999
 or p_evidence is null or char_length(btrim(p_evidence)) not between 3 and 1000 or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_note is null or char_length(btrim(p_note)) not between 3 and 1000
 or p_allocations is null or jsonb_typeof(p_allocations) is distinct from 'array' then raise exception 'Payment input invalid' using errcode='22023';end if;
 if jsonb_array_length(p_allocations) not between 1 and 20 then raise exception 'Allocation limit' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,290029));
 select * into prior from public.upstream_payment_records where request_id=p_request;
 if found then
 if prior.organization_id<>p_org or prior.bank_reference<>ref or prior.received_on<>p_received_on or prior.received_cad_minor<>p_received::bigint or prior.evidence_reference<>btrim(p_evidence) or prior.evidence_sha256<>p_hash or prior.note<>btrim(p_note) or prior.allocations<>p_allocations or prior.prepared_by<>auth.uid() then raise exception 'Payment request changed' using errcode='40001';end if;
 return prior.id;end if;
 perform pg_advisory_xact_lock(hashtextextended(ref,290030));
 select * into latest from public.upstream_payment_records where bank_reference=ref order by revision desc limit 1;
 if found then
 if latest.organization_id<>p_org or not exists(select 1 from public.upstream_payment_reviews where payment_id=latest.id and decision='rejected') then raise exception 'Bank reference already registered' using errcode='23505';end if;
 rev:=latest.revision+1;end if;
 for item in select value from jsonb_array_elements(p_allocations) loop
 if coalesce(item->>'statementId','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' or coalesce(item->>'amountMinor','') !~ '^[0-9]{1,10}$' then raise exception 'Allocation invalid' using errcode='22023';end if;
 select * into s from public.monthly_client_statements where id=(item->>'statementId')::uuid;
 if not found or s.organization_id<>p_org then raise exception 'Statement organization mismatch' using errcode='22023';end if;
 if (item->>'amountMinor')::numeric not between 1 and public.upstream_statement_amount(s.id) then raise exception 'Allocation exceeds procurement' using errcode='23514';end if;
 total:=total+(item->>'amountMinor')::numeric;
 end loop;
 if total<>p_received::numeric or (select count(distinct (v->>'statementId')::uuid) from jsonb_array_elements(p_allocations) v)<>jsonb_array_length(p_allocations) then raise exception 'Allocation total or duplicate invalid' using errcode='23514';end if;
 insert into public.upstream_payment_records(request_id,organization_id,revision,bank_reference,received_on,received_cad_minor,evidence_reference,evidence_sha256,note,allocations,prepared_by)
 values(p_request,p_org,rev,ref,p_received_on,p_received::bigint,btrim(p_evidence),p_hash,btrim(p_note),p_allocations,auth.uid()) returning id into result;
 insert into public.upstream_payment_allocations(payment_id,statement_id,amount_cad_minor) select result,(v->>'statementId')::uuid,(v->>'amountMinor')::bigint from jsonb_array_elements(p_allocations) v;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'upstream_payment',result,'INSERT',jsonb_build_object('organization_id',p_org));
 return result;
end $$;
create function public.review_upstream_payment(p_payment uuid,p_decision text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare p public.upstream_payment_records%rowtype;prior public.upstream_payment_reviews%rowtype;a record;paid numeric;
begin
 select * into p from public.upstream_payment_records where id=p_payment for update;
 if not found or not public.has_ops_capability('finance.review',p.organization_id) then raise exception 'Forbidden' using errcode='42501';end if;
 if p.prepared_by=auth.uid() then raise exception 'Independent reviewer required' using errcode='42501';end if;
 if p_decision is null or p_decision not in ('approved','rejected') or p_note is null or char_length(btrim(p_note)) not between 3 and 1000 then raise exception 'Review required' using errcode='22023';end if;
 select * into prior from public.upstream_payment_reviews where payment_id=p.id;
 if found then if prior.decision=p_decision and prior.note=btrim(p_note) and prior.reviewed_by=auth.uid() then return;end if;raise exception 'Review already recorded' using errcode='40001';end if;
 if p_decision='approved' then
 -- Shared statement locks serialize overlapping batches in deterministic order.
 for a in select statement_id,amount_cad_minor from public.upstream_payment_allocations where payment_id=p.id order by statement_id loop
 perform 1 from public.monthly_client_statements where id=a.statement_id for update;
 select coalesce(sum(x.amount_cad_minor),0) into paid from public.upstream_payment_allocations x join public.upstream_payment_reviews r on r.payment_id=x.payment_id and r.decision='approved' where x.statement_id=a.statement_id;
 if paid+a.amount_cad_minor>public.upstream_statement_amount(a.statement_id) then raise exception 'Allocation exceeds unreconciled procurement' using errcode='23514';end if;
 end loop;
 end if;
 insert into public.upstream_payment_reviews(payment_id,decision,reviewed_by,note) values(p.id,p_decision,auth.uid(),btrim(p_note));
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'upstream_payment_review',p.id,'INSERT',jsonb_build_object('decision',p_decision));
end $$;
create function public.get_upstream_payment_workbench(p_org uuid,p_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare statements jsonb;payments jsonb;n integer;pn integer;
begin
 if p_org is null or not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_month is null or not isfinite(p_month) or extract(day from p_month)<>1 then raise exception 'Month must start on day one' using errcode='22023';end if;
 select count(*) into n from public.monthly_client_statements where organization_id=p_org and month=p_month;
 select coalesce(jsonb_agg(x.row order by x.published_at desc,x.id desc),'[]'::jsonb) into statements from (
 select s.id,s.published_at,jsonb_build_object('id',s.id,'account_name',s.usage->>'account_name','month',s.month,'procurement_cad_minor',public.upstream_statement_amount(s.id)::text,
 'verified_cad_minor',coalesce((select sum(a.amount_cad_minor) from public.upstream_payment_allocations a join public.upstream_payment_reviews r on r.payment_id=a.payment_id and r.decision='approved' where a.statement_id=s.id),0)::text,
 'pending_cad_minor',coalesce((select sum(a.amount_cad_minor) from public.upstream_payment_allocations a left join public.upstream_payment_reviews r on r.payment_id=a.payment_id where a.statement_id=s.id and r.payment_id is null),0)::text) row
 from public.monthly_client_statements s where s.organization_id=p_org and s.month=p_month order by s.published_at desc,s.id desc limit 200)x;
 select count(*) into pn from public.upstream_payment_records p where p.organization_id=p_org and exists(select 1 from public.upstream_payment_allocations a join public.monthly_client_statements s on s.id=a.statement_id where a.payment_id=p.id and s.month=p_month);
 select coalesce(jsonb_agg(x.row order by x.pending desc,x.prepared_at desc,x.id desc),'[]'::jsonb) into payments from (
 select p.id,p.prepared_at,(r.payment_id is null) pending,jsonb_build_object('id',p.id,'revision',p.revision,'bank_reference',p.bank_reference,'received_on',p.received_on,'received_cad_minor',p.received_cad_minor::text,'evidence_reference',p.evidence_reference,'evidence_sha256',p.evidence_sha256,'note',p.note,'prepared_by',p.prepared_by,'prepared_at',p.prepared_at,'status',coalesce(r.decision,'pending'),'review_note',r.note,'reviewed_at',r.reviewed_at,
 'allocations',(select jsonb_agg(jsonb_build_object('statement_id',a.statement_id,'amount_cad_minor',a.amount_cad_minor::text,'month',s.month,'account_name',s.usage->>'account_name') order by a.statement_id) from public.upstream_payment_allocations a join public.monthly_client_statements s on s.id=a.statement_id where a.payment_id=p.id)) row
 from public.upstream_payment_records p left join public.upstream_payment_reviews r on r.payment_id=p.id where p.organization_id=p_org and exists(select 1 from public.upstream_payment_allocations a join public.monthly_client_statements s on s.id=a.statement_id where a.payment_id=p.id and s.month=p_month)
 order by (r.payment_id is null) desc,p.prepared_at desc,p.id desc limit 100)x;
 return jsonb_build_object('statements',statements,'statement_count',n,'payments',payments,'payment_count',pn);
end $$;
revoke all on function public.submit_upstream_payment(uuid,uuid,text,date,text,text,text,text,jsonb),public.review_upstream_payment(uuid,text,text),public.get_upstream_payment_workbench(uuid,date) from public,anon;
grant execute on function public.submit_upstream_payment(uuid,uuid,text,date,text,text,text,text,jsonb),public.review_upstream_payment(uuid,text,text),public.get_upstream_payment_workbench(uuid,date) to authenticated;
notify pgrst,'reload schema';
commit;
