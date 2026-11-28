-- Preview only, after 061. Reuses the existing Vault-authenticated job and URL.
-- Check this is the Preview Supabase project before executing. No secret values are printed.
-- Two-hour sweeps service the current two connected accounts; actual reads obey DB spacing/backoff.
select cron.alter_job(job_id:=jobid,schedule:='0 */2 * * *')
from cron.job where jobname='kbjm-preview-monthly-preparation' and active;
select jobname,schedule,active from cron.job where jobname='kbjm-preview-monthly-preparation';
