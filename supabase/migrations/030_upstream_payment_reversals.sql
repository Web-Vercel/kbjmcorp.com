-- Append-only reversal of receipt allocations, not a bank refund or client-wallet adjustment.
begin;
create table public.upstream_payment_reversals(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,payment_id uuid not null references public.upstream_payment_records(id),
 revision integer not null check(revision>0),reason text not null check(char_length(btrim(reason)) between 3 and 1000),
 evidence_reference text not null check(char_length(btrim(evidence_reference)) between 3 and 1000),evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 prepared_by uuid not null references auth.users(id),prepared_at timestamptz not null default now(),unique(payment_id,revision),unique(id,payment_id)
);
create table public.upstream_reversal_reviews(
 reversal_id uuid primary key,payment_id uuid not null,decision text not null check(decision in ('approved','rejected')),
 reviewed_by uuid not null references auth.users(id),note text not null check(char_length(btrim(note)) between 3 and 1000),reviewed_at timestamptz not null default now(),
 foreign key(reversal_id,payment_id) references public.upstream_payment_reversals(id,payment_id)
);
create unique index one_approved_upstream_reversal on public.upstream_reversal_reviews(payment_id) where decision='approved';
alter table public.upstream_payment_reversals enable row level security;
alter table public.upstream_reversal_reviews enable row level security;
revoke all on public.upstream_payment_reversals,public.upstream_reversal_reviews from public,anon,authenticated;
create trigger immutable_upstream_reversal before update or delete on public.upstream_payment_reversals for each row execute function public.lock_posted_money();
create trigger immutable_upstream_reversal_review before update or delete on public.upstream_reversal_reviews for each row execute function public.lock_posted_money();
create function public.submit_upstream_reversal(p_payment uuid,p_request uuid,p_reason text,p_evidence text,p_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.upstream_payment_records%rowtype;prior public.upstream_payment_reversals%rowtype;latest public.upstream_payment_reversals%rowtype;result uuid;rev integer:=1;
begin
 select * into p from public.upstream_payment_records where id=p_payment for update;
 if not found or not public.has_ops_capability('finance.prepare',p.organization_id) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_request is null or p_reason is null or char_length(btrim(p_reason)) not between 3 and 1000 or p_evidence is null or char_length(btrim(p_evidence)) not between 3 and 1000 or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Reversal evidence required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,300030));
 select * into prior from public.upstream_payment_reversals where request_id=p_request;
 if found then if prior.payment_id=p.id and prior.reason=btrim(p_reason) and prior.evidence_reference=btrim(p_evidence) and prior.evidence_sha256=p_hash and prior.prepared_by=auth.uid() then return prior.id;end if;raise exception 'Reversal request changed' using errcode='40001';end if;
 if not exists(select 1 from public.upstream_payment_reviews where payment_id=p.id and decision='approved') then raise exception 'Approved receipt required' using errcode='23514';end if;
 select * into latest from public.upstream_payment_reversals where payment_id=p.id order by revision desc limit 1;
 if found then
 if not exists(select 1 from public.upstream_reversal_reviews where reversal_id=latest.id and decision='rejected') then raise exception 'Reversal already pending or approved' using errcode='40001';end if;
 rev:=latest.revision+1;end if;
 insert into public.upstream_payment_reversals(request_id,payment_id,revision,reason,evidence_reference,evidence_sha256,prepared_by) values(p_request,p.id,rev,btrim(p_reason),btrim(p_evidence),p_hash,auth.uid()) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'upstream_reversal',result,'INSERT',jsonb_build_object('payment_id',p.id));
 return result;
end $$;
create function public.review_upstream_reversal(p_reversal uuid,p_decision text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare c public.upstream_payment_reversals%rowtype;p public.upstream_payment_records%rowtype;prior public.upstream_reversal_reviews%rowtype;a record;
begin
 select * into c from public.upstream_payment_reversals where id=p_reversal;
 if not found then raise exception 'Forbidden' using errcode='42501';end if;
 select * into p from public.upstream_payment_records where id=c.payment_id for update;
 if not public.has_ops_capability('finance.review',p.organization_id) then raise exception 'Forbidden' using errcode='42501';end if;
 if c.prepared_by=auth.uid() then raise exception 'Independent reviewer required' using errcode='42501';end if;
 if p_decision is null or p_decision not in ('approved','rejected') or p_note is null or char_length(btrim(p_note)) not between 3 and 1000 then raise exception 'Review required' using errcode='22023';end if;
 select * into prior from public.upstream_reversal_reviews where reversal_id=c.id;
 if found then if prior.decision=p_decision and prior.note=btrim(p_note) and prior.reviewed_by=auth.uid() then return;end if;raise exception 'Reversal review already recorded' using errcode='40001';end if;
 if p_decision='approved' then
 if not exists(select 1 from public.upstream_payment_reviews where payment_id=p.id and decision='approved') then raise exception 'Approved receipt required' using errcode='23514';end if;
 if exists(select 1 from public.upstream_reversal_reviews where payment_id=p.id and decision='approved') then raise exception 'Receipt already reversed' using errcode='40001';end if;
 for a in select statement_id from public.upstream_payment_allocations where payment_id=p.id order by statement_id loop
 perform 1 from public.monthly_client_statements where id=a.statement_id for update;
 end loop;
 end if;
 insert into public.upstream_reversal_reviews(reversal_id,payment_id,decision,reviewed_by,note) values(c.id,p.id,p_decision,auth.uid(),btrim(p_note));
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'upstream_reversal_review',c.id,'INSERT',jsonb_build_object('payment_id',p.id,'decision',p_decision));
end $$;
revoke all on function public.submit_upstream_reversal(uuid,uuid,text,text,text),public.review_upstream_reversal(uuid,text,text) from public,anon;
grant execute on function public.submit_upstream_reversal(uuid,uuid,text,text,text),public.review_upstream_reversal(uuid,text,text) to authenticated;


create or replace function public.submit_upstream_payment(p_request uuid,p_org uuid,p_reference text,p_received_on date,p_received text,p_evidence text,p_hash text,p_note text,p_allocations jsonb) returns uuid
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
 if latest.organization_id<>p_org or not (exists(select 1 from public.upstream_payment_reviews where payment_id=latest.id and decision='rejected') or exists(select 1 from public.upstream_reversal_reviews where payment_id=latest.id and decision='approved')) then raise exception 'Bank reference already registered' using errcode='23505';end if;
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

create or replace function public.review_upstream_payment(p_payment uuid,p_decision text,p_note text) returns void
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
 select coalesce(sum(x.amount_cad_minor),0) into paid from public.upstream_payment_allocations x join public.upstream_payment_reviews r on r.payment_id=x.payment_id and r.decision='approved' where x.statement_id=a.statement_id and not exists(select 1 from public.upstream_reversal_reviews rr where rr.payment_id=x.payment_id and rr.decision='approved');
 if paid+a.amount_cad_minor>public.upstream_statement_amount(a.statement_id) then raise exception 'Allocation exceeds unreconciled procurement' using errcode='23514';end if;
 end loop;
 end if;
 insert into public.upstream_payment_reviews(payment_id,decision,reviewed_by,note) values(p.id,p_decision,auth.uid(),btrim(p_note));
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'upstream_payment_review',p.id,'INSERT',jsonb_build_object('decision',p_decision));
end $$;

create or replace function public.get_upstream_payment_workbench(p_org uuid,p_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare statements jsonb;payments jsonb;n integer;pn integer;
begin
 if p_org is null or not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_month is null or not isfinite(p_month) or extract(day from p_month)<>1 then raise exception 'Month must start on day one' using errcode='22023';end if;
 select count(*) into n from public.monthly_client_statements where organization_id=p_org and month=p_month;
 select coalesce(jsonb_agg(x.row order by x.published_at desc,x.id desc),'[]'::jsonb) into statements from (
 select s.id,s.published_at,jsonb_build_object('id',s.id,'account_name',s.usage->>'account_name','month',s.month,'procurement_cad_minor',public.upstream_statement_amount(s.id)::text,
 'verified_cad_minor',coalesce((select sum(a.amount_cad_minor) from public.upstream_payment_allocations a join public.upstream_payment_reviews r on r.payment_id=a.payment_id and r.decision='approved' where a.statement_id=s.id and not exists(select 1 from public.upstream_reversal_reviews rr where rr.payment_id=a.payment_id and rr.decision='approved')),0)::text,
 'pending_cad_minor',coalesce((select sum(a.amount_cad_minor) from public.upstream_payment_allocations a left join public.upstream_payment_reviews r on r.payment_id=a.payment_id where a.statement_id=s.id and r.payment_id is null),0)::text) row
 from public.monthly_client_statements s where s.organization_id=p_org and s.month=p_month order by s.published_at desc,s.id desc limit 200)x;
 select count(*) into pn from public.upstream_payment_records p where p.organization_id=p_org and exists(select 1 from public.upstream_payment_allocations a join public.monthly_client_statements s on s.id=a.statement_id where a.payment_id=p.id and s.month=p_month);
 select coalesce(jsonb_agg(x.row order by x.pending desc,x.prepared_at desc,x.id desc),'[]'::jsonb) into payments from (
 select p.id,p.prepared_at,(r.payment_id is null or exists(select 1 from public.upstream_payment_reversals c left join public.upstream_reversal_reviews rr on rr.reversal_id=c.id where c.payment_id=p.id and rr.reversal_id is null)) pending,jsonb_build_object('id',p.id,'revision',p.revision,'bank_reference',p.bank_reference,'received_on',p.received_on,'received_cad_minor',p.received_cad_minor::text,'evidence_reference',p.evidence_reference,'evidence_sha256',p.evidence_sha256,'note',p.note,'prepared_by',p.prepared_by,'prepared_at',p.prepared_at,'status',coalesce(r.decision,'pending'),'review_note',r.note,'reviewed_at',r.reviewed_at,
 'reversed',exists(select 1 from public.upstream_reversal_reviews rr where rr.payment_id=p.id and rr.decision='approved'),
 'reversal_pending',exists(select 1 from public.upstream_payment_reversals c left join public.upstream_reversal_reviews rr on rr.reversal_id=c.id where c.payment_id=p.id and rr.reversal_id is null),
 'reversal_count',(select count(*) from public.upstream_payment_reversals where payment_id=p.id),
 'reversals',coalesce((select jsonb_agg(h.row order by h.revision desc) from (select c.revision,jsonb_build_object('id',c.id,'revision',c.revision,'reason',c.reason,'evidence_reference',c.evidence_reference,'evidence_sha256',c.evidence_sha256,'prepared_by',c.prepared_by,'prepared_at',c.prepared_at,'status',coalesce(rr.decision,'pending'),'review_note',rr.note,'reviewed_at',rr.reviewed_at) row from public.upstream_payment_reversals c left join public.upstream_reversal_reviews rr on rr.reversal_id=c.id where c.payment_id=p.id order by c.revision desc limit 10)h),'[]'::jsonb),
 'allocations',(select jsonb_agg(jsonb_build_object('statement_id',a.statement_id,'amount_cad_minor',a.amount_cad_minor::text,'month',s.month,'account_name',s.usage->>'account_name') order by a.statement_id) from public.upstream_payment_allocations a join public.monthly_client_statements s on s.id=a.statement_id where a.payment_id=p.id)) row
 from public.upstream_payment_records p left join public.upstream_payment_reviews r on r.payment_id=p.id where p.organization_id=p_org and exists(select 1 from public.upstream_payment_allocations a join public.monthly_client_statements s on s.id=a.statement_id where a.payment_id=p.id and s.month=p_month)
 order by (r.payment_id is null or exists(select 1 from public.upstream_payment_reversals c left join public.upstream_reversal_reviews rr on rr.reversal_id=c.id where c.payment_id=p.id and rr.reversal_id is null)) desc,p.prepared_at desc,p.id desc limit 100)x;
 return jsonb_build_object('reversal_enabled',true,'statements',statements,'statement_count',n,'payments',payments,'payment_count',pn);
end $$;
notify pgrst,'reload schema';
commit;
