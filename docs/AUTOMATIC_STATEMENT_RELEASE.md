# Preview automatic statement release — explicit opt-in

This extends scheduled draft preparation with a separate system-rule authorization. It does not create a human review record or reuse a reviewer's identity. Existing accounts, including Brianna, remain on their existing draft-only/manual publication authorization. Production is excluded by the server flag and this release's branch scope.

## Release and activation

1. Apply `supabase/migrations/059_automatic_statement_release.sql` **only to the Preview database**, after migrations 001–058; then apply `060_automatic_release_pricing_defaults.sql`. This is one transaction and does not enable any account. Do not rerun the migration or run the fresh-project bootstrap on an existing database.
2. Deploy `preview/tenant-isolation` to Preview. Leave `MONTHLY_AUTO_RELEASE_ENABLED` absent/false until local and hosted fictional acceptance are satisfactory.
3. In 月结办理 → 自动月结 → 定时月结设置与任务 → 自动发布与预付余额扣减（单独授权）, select an account already authorized for scheduled preparation with a first consumption month. The page reads effective monthly fees from the existing pricing settings: customer field override → system field → built-in default (15%/20%/5%). Zero is an explicit override. Fees are read-only and consent is pinned to the displayed rate token; a concurrent change rejects saving. Enter the authorization agreement. The CNY cap and monthly change threshold are optional under Advanced settings; blank means no additional limit. Check the separate consent and save. Default is off; no anomaly limit is silently supplied. Existing explicitly configured limits are preserved by migration 060.
4. Before enabling processing, verify Preview's existing `MONTHLY_AUTOMATION_ENABLED`, scheduler authorization and `COLLECTIONS_TEST_ORGANIZATION_ID`. If that test scope is configured, automatic publication is restricted to the exact fictional organization `财务流程验收企业（虚构）`, just like manual publication. Real Brianna/Kenny accounts cannot bypass that boundary.
5. Set Preview-only `MONTHLY_AUTO_RELEASE_ENABLED=true` and redeploy the **Preview branch**, then use the existing authenticated scheduler invocation. Do not place the flag in Production. No key values belong in screenshots, SQL files, logs or browser forms.
6. Check the persisted run and actual statement/ledger, not just an HTTP 200. `manual_required` is an expected blocked result, `unconfirmed`/503 means investigate persisted state. Enabling authorization never upgrades an older prepared draft: use the existing human review/publication path for it.

Disabling the account policy or global flag stops future automatic release; already-published immutable statements and ledger entries remain. Changing scheduled preparation invalidates the pinned policy revision and requires new authorization. Blocked runs remain manual, even if configuration later changes; there is no blind retry button.

## Checks and money boundary

- Active binding, active administrator authorizations, enabled preparation and separate enabled publication policy, exact preparation revision/first month, job created after policy authorization.
- One complete closed natural month, CAD account and matching company/source/quote/job; platform total agrees with daily total, accepted complete/aggregate coverage, no newer monthly snapshot.
- Worker-supplied Bank of Canada FXCNYCAD month-end evidence: exact request range, reciprocal rate, dates, positive rate and post-month retrieval. The worker obtains the last published monthly observation over HTTPS. This is evidence checking, not a cryptographic signature from the bank.
- Only inherited and explicitly authorized percentage fees and customer-borne transfer markup. PostgreSQL independently recalculates every monetary output using integer cents/decimal arithmetic. Special/fixed fees and other FX policies require manual processing.
- No previous human review, archived quote, conflicting draft, published bill, unresolved billing/statement issue or earlier unsettled month.
- Optional CNY cap; optional absolute upward/downward change threshold against the previous bill. When configured, the first bill uses the cap; previous zero → positive goes manual only if the change limit is configured. A zero change threshold is distinct from blank. Zero threshold permits unchanged amounts only.
- Existing CNY wallet and available posted prepaid funds after refund holds and other approved commitments. No bank/card charge, transfer, gateway or auto-refund is initiated.

Validation proof, statement and both ledger lines share one database transaction/subtransaction. A second-line failure rolls back the first line and statement. A blocked run records its reason with no posting. Wallet/account/draft/quote/settings and pricing-table locks serialize competing publications, refunds, source arrivals, disputes and decisions. Unique account-month guards prevent repeat billing, including legacy/manual publications. A review arriving after publication is rejected.

Publication records `publication_mode=automatic_rules`, a release-proof reference and **NULL `published_by`**. Audit records identify system execution explicitly; a human remains identifiable only as the person who authorized the policy. Fee details, calculation and FX evidence stay private; customer usage/summary contains no internal cost/FX proof. Authorized finance users can see the exception reason and retained draft link. Existing role-scoped pending review queues remain available; this change does not send email, SMS or WeChat messages.

## Verification and limits

- `npm test -- tests/automatic-release-database.test.ts tests/automatic-release-api.test.ts tests/automatic-release-ui.test.tsx` covers opt-in, retroactive authorization rejection, calculation/FX failures, caps, dispute/source conflicts, holds, access control, transactional rollback, and explicit UI consent.
- `npm run verify:auto-release` uses a disposable network-isolated PostgreSQL 17 container. Five simultaneous calls must produce exactly one statement and one debit set, with no human review. An in-flight billing dispute must block publication without debit. No hosted database is used. The drill also checks a concurrent effective fee update blocks release after its transaction commits.
- Existing administrator, human publication, worker, workbench and build checks remain regression requirements.
- Hosted account activation, scheduled execution and customer-role acceptance have **not** been verified by local tests. These remain deployment/acceptance steps.
- This is a bounded Preview implementation using the existing registry (up to ten configured connections) and daily rotating batch of two. It is **not yet a thousand-account production scheduler**. Before expansion, add a durable paged account queue, bounded dispatch, monitored retries/escalation and load/concurrency acceptance under real hosting limits.
- Rules reduce risk but cannot guarantee external source correctness. Corrections to already published bills need a separate audited adjustment workflow; no automatic rewriting of published financial history.

Migration 060 preserves existing policy pins and explicit limits, adds nullable limits, resolves monthly pricing in the database and enforces effective-rate rechecks. It does not enable any account or the global worker flag. The legacy configuration signature remains available only when supplied fees match authoritative settings; it cannot override pricing. The fee display uses the later of the first consumption month and the current account-local month; release checks the actual invoice month. Future-effective fee changes do not alter earlier invoices.
