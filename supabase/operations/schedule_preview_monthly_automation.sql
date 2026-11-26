-- Optional hosted activation, AFTER 056, administrator opt-in, environment configuration
-- and a successful authenticated manual worker invocation. Not a migration.
-- Enable pg_cron and pg_net via Supabase Extensions first.
-- Store secrets through Supabase Vault UI (never paste secrets in shared SQL/history):
-- kbjm_preview_monthly_worker_url: exact Preview URL ending /api/internal/monthly-automation
-- kbjm_monthly_cron_secret: same >=32-character CRON_SECRET as Preview server
-- kbjm_preview_protection_bypass: optional Vercel automation bypass secret when protection is enabled
-- Check cron.job for name below first. This script deliberately does not replace an existing job.
select cron.schedule('kbjm-preview-monthly-preparation','0 16 * * *',
$job$
select net.http_get(
 url:=(select decrypted_secret from vault.decrypted_secrets where name='kbjm_preview_monthly_worker_url'),
 headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='kbjm_monthly_cron_secret'))
 ||case when exists(select 1 from vault.decrypted_secrets where name='kbjm_preview_protection_bypass') then jsonb_build_object('x-vercel-protection-bypass',(select decrypted_secret from vault.decrypted_secrets where name='kbjm_preview_protection_bypass')) else '{}'::jsonb end,
 timeout_milliseconds:=60000
)
where exists(select 1 from vault.decrypted_secrets where name='kbjm_preview_monthly_worker_url' and decrypted_secret like 'https://%/api/internal/monthly-automation')
 and exists(select 1 from vault.decrypted_secrets where name='kbjm_monthly_cron_secret' and length(decrypted_secret)>=32);
$job$)
where not exists(select 1 from cron.job where jobname='kbjm-preview-monthly-preparation');
