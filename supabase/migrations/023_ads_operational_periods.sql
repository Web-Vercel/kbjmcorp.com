-- Bounded completed-day operational source windows; never a billing authorization.
begin;
alter table public.ads_reporting_snapshots drop constraint if exists ads_reporting_snapshot_period;
alter table public.ads_reporting_snapshots drop constraint if exists ads_reporting_snapshots_check;
alter table public.ads_reporting_snapshots add constraint ads_reporting_snapshot_period check(until between since and since+30);
notify pgrst, 'reload schema';
commit;
