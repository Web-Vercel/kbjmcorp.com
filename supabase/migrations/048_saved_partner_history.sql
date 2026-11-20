-- Read-back only: existing partner notes and fee versions. No financial or authorization writes.
begin;
create function public.read_saved_partner_history(p_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner boolean:=public.has_staff_access(array['admin']::text[]); notes jsonb; policies jsonb;
begin
 if not public.has_ops_capability('finance.read') then raise exception 'Finance access required' using errcode='42501';end if;
 if p_ids is null or cardinality(p_ids)>500 then raise exception 'At most 500 record IDs required' using errcode='22023';end if;
 -- Return notes only, not raw request JSON, bank fields, Auth data or credentials.
 -- A non-administrator may revisit their own saved explanations, never another person's private note.
 select coalesce(jsonb_agg(t),'[]'::jsonb) into notes from (
  select a.result->>'id' entity_id,a.input->>'action' action,a.input->'data'->>'note' note,a.created_at
  from public.partner_actions a
  where (owner or a.actor_id=auth.uid())
   and a.result->>'id'=any(array(select x::text from unnest(p_ids) x))
   and a.input->>'action' in ('agent_save','assignment_save','assignment_end','lead_review','refund_policy','refund_prepare','refund_review','refund_approve','refund_reject','refund_withdraw','refund_cancel','commission_prepare','commission_adjust','commission_review','settlement_prepare','settlement_review','settlement_approve','settlement_cancel','payment_record','payment_verify')
   and a.input->'data'->>'note' is not null
  order by a.created_at desc,a.request_id desc limit 1000
 )t;
 select coalesce(jsonb_agg(t),'[]'::jsonb) into policies from (
  select p.id,p.wallet_id,p.mode,p.value,p.agreement,p.active,p.created_at
  from public.refund_policies p where owner and p.wallet_id=any(p_ids)
  order by p.created_at desc,p.id desc limit 1000
 )t;
 return jsonb_build_object('notes',notes,'policies',policies,'notes_limit',1000,'policies_limit',1000);
end $$;
revoke all on function public.read_saved_partner_history(uuid[]) from public,anon;
grant execute on function public.read_saved_partner_history(uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
