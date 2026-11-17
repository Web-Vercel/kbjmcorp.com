# Autonomous acceptance — Preview development

The owner authorized independent role-based testing with fictional data. The Cloud session has no callable shared-browser controller, hosted role credentials or MFA completion channel. This batch therefore runs automatically against disposable local PostgreSQL-compatible databases, local API/component tests, and anonymous browsers against the actual built app. It does not impersonate hosted sessions or claim hosted bank verification.

## Scope

- Client A/B, unrelated agents, investor/sales and anonymous access separation.
- Preparer versus independent reviewer versus administrator authority, including self-review denials.
- Refund request, policy snapshot/fee arithmetic, reserved funds, cancellation/rejection, assessment, independent review, approval, payment registration and independent verification.
- Agent refund progress at every stage, unrelated/backdated assignee exclusion, sensitive-field filtering and commission hold display.
- A new end-to-end database case uses actual role-authenticated RPC calls: request -> prepare -> independent review -> approve -> record exact net payment -> independent payment verification. It asserts no ledger debit at request/approval/payment registration, exact gross debit only after verification, unchanged unrelated-company balance, released reservation, rejection of wrong payment amount/self-review, and identical-request retry without a second debit. All parties, payment references and funds are local fictional fixtures.
- Existing commission tests check holds during customer refunds, settlement eligibility/waiting period, deductions and immutable historical payments.
- Existing financial suites cover source ownership, monthly completeness, quote versions, publication, one-time wallet posting, intercompany allocation/reversal, exports, exact amounts and timezone boundaries.
- Existing authentication/credential suites retain password-only external entry, internal MFA, revoked/stale session denial, account maintenance uncertainty locks and role restrictions.

## Fixes

1. Regenerated the new-project bootstrap with the existing generator. It now includes migration 047's source SHA-256 and canonical boundary markers. SQL behavior was already present; no migration logic or hosted database changed. Do not rerun the bootstrap or 047 on the existing Preview project because of this formatting fix.
2. Updated the cash-summary regression to verify each pending category's amount and count in its current compact layout. The failure was stale display text, not incorrect pending money. The unavailable-state assertion still forbids a fabricated zero.
3. Added a reusable local-only anonymous browser/route smoke script, and `test:autonomous` / `test:autonomous-access` commands. The browser script refuses non-loopback targets and never submits login or financial actions.

## Verification evidence

Final local test result: **205 files, 1,111 tests passed, zero failed and zero skipped**, across eight fresh sequential processes. All four optional visual-artifact checks ran. Exact discovered-file coverage was verified. `npm run typecheck` and `npm run db:bundle:check` passed. The final optimized Next build also passed.

- Initial full run: 205 files; two failures (bootstrap synchronization and old cash-summary wording), four optional artifact cases skipped. Those failures were corrected without weakening the financial or access assertions.
- Two subsequent single-process runs hit a native Node/V8 `jit_page.has_value()` failure after repeated WebAssembly database initialization. They are reported as interrupted, not passed. The reusable runner now partitions the complete discovered test-file list into eight fresh, sequential processes, then verifies exact file coverage and requires zero failed/skipped assertions. No failed batch is automatically converted to success or silently retried.
- Additional full refund/agent integration plus bootstrap tests passed locally before the final run.
- Local built-app smoke: 110 checks passed across Chinese/English internal and external anonymous routes, retired demo paths, 375px/1440px login pages, no page script errors or horizontal overflow, no retired login links and no form submissions. Existing verified document return URLs may show the legacy login page; an unscoped legacy login redirects to the unified external login. `/demo` redirects to unified login for cookie cleanup; retired preview trees return 404. If analytics configuration is unavailable it must show an explicit alert, never invented zero money. This is not an authenticated analytics-read claim.

## Previously observed hosted results retained

The owner's screenshots confirmed the fictional October procurement CAD45.30 was independently allocated, unreconciled and pending were both CAD0.00, and client balance remained CNY703.23. The month-close flow showed seven published-bill stages completed and no linked billing questions. The owner executed 047 in the Preview project and the corresponding agent portal showed a readable empty refund queue. These are screenshot-supported outcomes, not new autonomous hosted actions.

## Hosted items still unverified

- The fictional customer has no refund fee agreement configured; screenshots show the application button disabled. No hosted refund request, policy, approval or refund payment was created in this batch.
- Therefore hosted refund progress synchronization and hold/release after a real Preview request are still not accepted merely because local tests passed.
- November client funds reports remain limited to ended calendar months. Do not bypass the closed-month rule or treat an unavailable report as a zero balance. The earlier internal monthly-summary query error remains a separate hosted configuration/query check.
- Commission waiting periods must not be bypassed. No real payment, online gateway, email notification, automatic recovery, Production deployment, role reset, password/MFA change or hosted account creation occurred.

## Repeatable commands

- `npm run test:autonomous` runs the entire discovered test suite in stable sequential batches. Results are in `/tmp/kbjm-autonomous-tests/summary.json` plus per-batch JSON/log files.
- Start the built local app on port 3036, then run `npm run test:autonomous-access` for the 110 anonymous boundary and browser checks; stop the local server afterward. The smoke script rejects hosted origins.
- `npm run db:bundle:check` verifies initialization source integrity without connecting to a database.

Remaining live-session work requires an authorized authenticated browser/test-account access channel. Report those access blockers once; do not ask the owner to step through every locally automatable case. Never label all hosted role acceptance complete based on this report.
