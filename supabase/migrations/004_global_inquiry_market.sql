-- Keep UI, server validation and persisted market options aligned.
begin;
alter table public.inquiries drop constraint inquiries_target_market_check;
alter table public.inquiries add constraint inquiries_target_market_check
 check(target_market in ('undecided','north-america','europe','asia-pacific','global','other'));
commit;
