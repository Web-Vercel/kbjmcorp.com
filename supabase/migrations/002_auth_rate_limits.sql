-- Apply to the separate Supabase project after 001_initial.sql.
begin;
create table public.auth_rate_limits (
 bucket text primary key,
 window_start bigint not null,
 attempts integer not null check(attempts >= 0),
 updated_at timestamptz not null default now()
);
alter table public.auth_rate_limits enable row level security;
revoke all on public.auth_rate_limits from public, anon, authenticated;
grant all on public.auth_rate_limits to service_role;

-- Atomic across all configured buckets. Hashed phone buckets never store raw phone numbers.
-- A global bound also limits a distributed attack using many different numbers.
create function public.consume_auth_limits(p_keys text[], p_limits integer[], p_windows integer[])
returns integer language plpgsql security definer set search_path = '' as $$
declare
 i integer; current_epoch bigint := floor(extract(epoch from clock_timestamp()));
 start_at bigint; current_row public.auth_rate_limits%rowtype; wait_seconds integer := 0;
begin
 if cardinality(p_keys) is null or cardinality(p_keys) < 1 or cardinality(p_keys) > 8
 or cardinality(p_keys) <> cardinality(p_limits) or cardinality(p_keys) <> cardinality(p_windows)
 then raise exception 'Invalid limit configuration'; end if;
 perform pg_advisory_xact_lock(721904831);
 for i in 1..cardinality(p_keys) loop
  if p_keys[i] is null or p_limits[i] is null or p_windows[i] is null
  or p_limits[i] < 1 or p_windows[i] < 1 or p_windows[i] > 86400
  then raise exception 'Invalid limit configuration'; end if;
  start_at := (current_epoch / p_windows[i]) * p_windows[i];
  select * into current_row from public.auth_rate_limits where bucket = p_keys[i];
  if found and current_row.window_start = start_at and current_row.attempts >= p_limits[i] then
   wait_seconds := greatest(wait_seconds, (start_at + p_windows[i] - current_epoch)::integer);
  end if;
 end loop;
 if wait_seconds > 0 then return wait_seconds; end if;
 for i in 1..cardinality(p_keys) loop
  start_at := (current_epoch / p_windows[i]) * p_windows[i];
  insert into public.auth_rate_limits as target(bucket,window_start,attempts,updated_at)
  values(p_keys[i],start_at,1,now()) on conflict(bucket) do update
  set attempts = case when target.window_start = excluded.window_start then target.attempts + 1 else 1 end,
  window_start = excluded.window_start, updated_at = now();
 end loop;
 return 0;
end;
$$;
revoke all on function public.consume_auth_limits(text[],integer[],integer[]) from public, anon, authenticated;
grant execute on function public.consume_auth_limits(text[],integer[],integer[]) to service_role;
comment on table public.auth_rate_limits is 'Server-only fixed-window abuse counters; schedule deletion of rows older than 48 hours.';
commit;
