-- Mainland-China-first lead intake: phone OR email, independent of Auth accounts.
begin;
alter table public.inquiries alter column email drop not null;
alter table public.inquiries add column phone_e164 text
 check(phone_e164 is null or phone_e164 ~ '^\+861[3-9][0-9]{9}$');
alter table public.inquiries add column target_market text not null default 'undecided'
 check(target_market in ('undecided','north-america','europe','asia-pacific','other'));
alter table public.inquiries add constraint inquiry_contact_required check(
 nullif(btrim(email),'') is not null or phone_e164 is not null
);
comment on column public.inquiries.phone_e164 is 'Private inquiry follow-up contact only. Never grants Auth or organization membership.';
commit;
