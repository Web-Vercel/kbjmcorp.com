-- Permit complete natural months in addition to the existing seven-day source snapshots.
-- This does not approve source data, publish statements or post any wallet entry.
begin;
alter table public.ads_reporting_snapshots drop constraint ads_reporting_snapshots_check;
alter table public.ads_reporting_snapshots add constraint ads_reporting_snapshot_period check(
 until=since+6 or (
  extract(day from since)=1
  and until=(since+interval '1 month'-interval '1 day')::date
 )
);
notify pgrst, 'reload schema';
commit;
