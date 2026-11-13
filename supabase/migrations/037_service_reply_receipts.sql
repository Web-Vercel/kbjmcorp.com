-- Reply receipts protect retries; they do not change billing or money.
begin;
alter table public.service_request_messages
 add column reply_request_key uuid,
 add column reply_input_sha256 text,
 add column reply_result_status text;
alter table public.service_request_messages add constraint service_reply_receipt_fields check(
 (reply_request_key is null and reply_input_sha256 is null and reply_result_status is null)
 or (reply_request_key is not null and reply_input_sha256 is not null and reply_input_sha256 ~ '^[0-9a-f]{64}$'
 and reply_result_status is not null and reply_result_status in ('open','in_progress','resolved')));
create unique index service_reply_actor_key on public.service_request_messages(author_id,reply_request_key) where reply_request_key is not null;
-- Existing authenticated column grants deliberately exclude the key, digest and receipt status.
create function public.guard_service_reply_receipt() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Confirmed service replies are immutable' using errcode='23514';end $$;
revoke all on function public.guard_service_reply_receipt() from public,anon,authenticated;
create trigger immutable_service_reply before update or delete on public.service_request_messages
 for each row when (OLD.reply_request_key is not null) execute function public.guard_service_reply_receipt();
create function public.reply_service_request_once(p_id uuid,p_request uuid,p_body text,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.service_requests%rowtype;m public.service_request_messages%rowtype;staff boolean;fingerprint text;next_status text;
begin
 if auth.uid() is null then raise exception 'Forbidden' using errcode='42501';end if;
 if p_request is null or p_body is null or char_length(btrim(p_body)) not between 3 and 1500 then raise exception 'Invalid reply' using errcode='22023';end if;
 -- Serialize reuse of an actor's key, including attempts to reuse it on another thread.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_request::text,370037));
 select * into r from public.service_requests where id=p_id for update;
 if not found or not public.can_read_service_request(r.organization_id,r.category) then raise exception 'Forbidden' using errcode='42501';end if;
 staff:=exists(select 1 from public.staff_members where user_id=auth.uid());
 if staff and (p_status is null or p_status not in ('open','in_progress','resolved')) then raise exception 'Invalid status' using errcode='22023';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(btrim(p_body),case when staff then p_status else null end)::text,'UTF8')),'hex');
 select * into m from public.service_request_messages where author_id=auth.uid() and reply_request_key=p_request;
 if found then
  if m.request_id<>p_id or m.reply_input_sha256<>fingerprint then raise exception 'Reply key conflict' using errcode='40001';end if;
  return jsonb_build_object('message_id',m.id,'request_id',m.request_id,'status',m.reply_result_status,'created_at',m.created_at,'replayed',true);
 end if;
 if (select count(*) from public.service_request_messages where request_id=p_id)>=200 then raise exception 'Message limit' using errcode='54000';end if;
 next_status:=case when staff then p_status when r.status='resolved' then 'open' else r.status end;
 insert into public.service_request_messages(request_id,body,author_id,author_role,reply_request_key,reply_input_sha256,reply_result_status)
 values(p_id,btrim(p_body),auth.uid(),case when staff then 'staff' else 'client' end,p_request,fingerprint,next_status) returning * into m;
 update public.service_requests set status=next_status,updated_at=now() where id=p_id;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'service_request',p_id,'UPDATE',jsonb_build_object('status',case when staff then next_status else 'client_reply' end,'message_id',m.id,'idempotent_reply',true));
 return jsonb_build_object('message_id',m.id,'request_id',m.request_id,'status',m.reply_result_status,'created_at',m.created_at,'replayed',false);
end $$;
revoke all on function public.reply_service_request_once(uuid,uuid,text,text) from public,anon;
grant execute on function public.reply_service_request_once(uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
