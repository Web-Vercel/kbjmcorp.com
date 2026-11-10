-- Connect client billing questions to immutable posted statements, reusing service threads.
begin;
alter table public.service_requests add column statement_id uuid references public.monthly_client_statements(id),add column statement_month date,add column statement_request_key uuid,add column statement_input_sha256 text;
alter table public.service_requests add constraint statement_question_fields check(
 (statement_id is null and statement_month is null and statement_request_key is null and statement_input_sha256 is null)
 or (statement_id is not null and statement_month is not null and extract(day from statement_month)=1 and statement_request_key is not null and statement_input_sha256 is not null and statement_input_sha256 ~ '^[0-9a-f]{64}$' and category='billing'));
create unique index service_statement_request_key on public.service_requests(created_by,statement_request_key) where statement_request_key is not null;
create index service_statement_questions on public.service_requests(statement_id,updated_at desc) where statement_id is not null;
create function public.guard_statement_question() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and (NEW.statement_id,NEW.statement_month,NEW.statement_request_key,NEW.statement_input_sha256) is distinct from (OLD.statement_id,OLD.statement_month,OLD.statement_request_key,OLD.statement_input_sha256) then raise exception 'Statement association is immutable' using errcode='23514';end if;
 if NEW.statement_id is not null and not exists(select 1 from public.monthly_client_statements s where s.id=NEW.statement_id and s.organization_id=NEW.organization_id and s.month=NEW.statement_month) then raise exception 'Statement organization or month mismatch' using errcode='23514';end if;
 return NEW;
end $$;
revoke all on function public.guard_statement_question() from public,anon,authenticated;
create trigger statement_question_guard before insert or update on public.service_requests for each row execute function public.guard_statement_question();
grant select(statement_id,statement_month) on public.service_requests to authenticated;
create function public.create_statement_question(p_statement uuid,p_request uuid,p_subject text,p_body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.monthly_client_statements%rowtype;r public.service_requests%rowtype;fingerprint text;result uuid;
begin
 select * into s from public.monthly_client_statements where id=p_statement;
 if not found or auth.uid() is null or exists(select 1 from public.staff_members where user_id=auth.uid()) or not public.has_finance_access(s.organization_id) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_request is null or p_subject is null or char_length(btrim(p_subject)) not between 3 and 160 or p_body is null or char_length(btrim(p_body)) not between 3 and 1500 then raise exception 'Invalid billing question' using errcode='22023';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(btrim(p_subject),btrim(p_body))::text,'UTF8')),'hex');
 perform 1 from public.organizations where id=s.organization_id for update;
 select * into r from public.service_requests where created_by=auth.uid() and statement_request_key=p_request;
 if found then
 if r.statement_id<>s.id or r.statement_input_sha256<>fingerprint then raise exception 'Request key conflict' using errcode='22023';end if;
 return r.id;
 end if;
 if (select count(*) from public.service_requests where organization_id=s.organization_id and status<>'resolved')>=20 then raise exception 'Open request limit' using errcode='54000';end if;
 insert into public.service_requests(organization_id,category,subject,created_by,statement_id,statement_month,statement_request_key,statement_input_sha256)
 values(s.organization_id,'billing',btrim(p_subject),auth.uid(),s.id,s.month,p_request,fingerprint) returning id into result;
 insert into public.service_request_messages(request_id,body,author_id,author_role) values(result,btrim(p_body),auth.uid(),'client');
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'service_request',result,'INSERT',jsonb_build_object('organization_id',s.organization_id,'category','billing','statement_id',s.id));
 return result;
end $$;
revoke all on function public.create_statement_question(uuid,uuid,text,text) from public,anon;
grant execute on function public.create_statement_question(uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
