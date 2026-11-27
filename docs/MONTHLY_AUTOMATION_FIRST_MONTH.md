# First automatic settlement month — Preview

Apply only `supabase/migrations/057_monthly_automation_first_month.sql` to the existing **智点未来-Preview（内测开发系统）** project. Do not rerun 056 or the new-project bootstrap. No Production SQL or backend deployment is included.

Migration adds nullable `first_month` to automation settings. Existing settings retain their values and historical unbounded behavior; no account is enabled and no completed source, quote or draft is rewritten. New configurations require a first consumption month. The three-argument compatibility function preserves the existing boundary; new callers use four arguments. Saving settings still cancels outstanding leases/tasks as before.

Both queue creation and claim selection reject months before `first_month`, including existing retry tasks. The worker still processes the preceding closed calendar month in the advertising account timezone, not the page's viewing month. There is no historical backfill.

Brianna Preview acceptance: select `2026-11`, retain paused until the actual test agreement is recorded, then explicitly enable. While the preceding closed month is October, the worker must stay idle for Brianna. From December, it may process November. Already completed independent review/publication rules remain unchanged.

User authorized Preview test pricing 15% / 20% / 5%, customer-borne cross-border costs and month-end Bank of Canada reference FX. This does not assert consent by an external Brianna customer for Production. Rate settings are separate from enabling automation.

Verification: database tests cover legacy settings preservation, before-start skip without job creation, existing retry exclusion, inclusive closed first month, pause compatibility, retained prepared drafts, and RPC permissions; API tests cover explicit month validation, scoped argument and unavailable storage. Hosted migration and scheduled execution require separate observation.
