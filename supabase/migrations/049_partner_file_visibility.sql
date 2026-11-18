begin;
-- Keep evidence immutable; removal affects presentation, never the original file.
create table public.partner_file_visibility (
 request_id uuid primary key, file_id uuid not null references public.partner_files(id),
 hidden boolean not null, reason text not null check(reason in ('mistake','replaced','restore')),
 actor_id uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp(),
 check((hidden and reason in ('mistake','replaced')) or (not hidden and reason='restore'))
);
alter table public.partner_file_visibility enable row level security;
revoke all on public.partner_file_visibility from public,anon,authenticated;
create trigger immutable_partner_file_visibility before update or delete on public.partner_file_visibility for each row execute function public.lock_posted_money();
create function public.set_partner_file_visibility(p_request uuid,p_file uuid,p_hidden boolean,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.partner_file_visibility%rowtype;
begin
 perform public.read_partner_file(p_file); -- Existing administrator/MFA or active owning agent gate.
 perform 1 from public.partner_files where id=p_file for update;
 select * into existing from public.partner_file_visibility where request_id=p_request;
 if found then
  if existing.actor_id<>auth.uid() or existing.file_id<>p_file or existing.hidden<>p_hidden or existing.reason<>p_reason then raise exception 'Request conflict' using errcode='23505';end if;
  return p_file;
 end if;
 insert into public.partner_file_visibility(request_id,file_id,hidden,reason,actor_id) values(p_request,p_file,p_hidden,p_reason,auth.uid());
 return p_file;
end $$;
create function public.read_partner_file_visibility() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.has_staff_access(array['admin']::text[]) then perform public.require_partner_agent(true);end if;
 return coalesce((select jsonb_agg(t) from (select distinct on (v.file_id) v.file_id,v.hidden,v.reason from public.partner_file_visibility v join public.partner_files f on f.id=v.file_id where public.can_partner_file_path(f.object_path) order by v.file_id,v.created_at desc,v.request_id desc)t),'[]'::jsonb);
end $$;
revoke all on function public.set_partner_file_visibility(uuid,uuid,boolean,text),public.read_partner_file_visibility() from public,anon;
grant execute on function public.set_partner_file_visibility(uuid,uuid,boolean,text),public.read_partner_file_visibility() to authenticated;
notify pgrst, 'reload schema';
commit;
