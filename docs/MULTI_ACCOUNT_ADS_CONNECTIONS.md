# Preview multi-account reporting connections

## Delivered first optimization

The advertising sync page offers a compact account selector. Reads, source history and ownership confirmation stay scoped to the selected account. Existing primary ADS_REPORTING_* variables remain supported without edits. Additional connections live in a server-only registry and reference individual secret environment variables; the browser receives only account ID, label and enabled status. Connection configuration is not proof of an API connection or of client ownership.

`ADS_REPORTING_CONNECTIONS_JSON` (Preview config) accepts at most ten entries:

```json
[{"accountId":"adacct_REPLACE_WITH_REAL_ID","label":"Brianna","keyEnv":"ADS_REPORTING_KEY_BRIANNA","currency":"CAD","enabled":true}]
```

Replace the example ID with the verified actual advertiser ID. Store that account's real authorized credential only in Preview's sensitive server variable `ADS_REPORTING_KEY_BRIANNA`, not in the JSON, repository, browser form or chat. The JSON is metadata; keyEnv must start ADS_REPORTING_KEY_. Do not change the existing primary account ID/key. Additional registry entries cannot duplicate another ID or override the primary account. Malformed registry disables the additional entries and displays a configuration error, without changing the primary connection. Missing/disabled secondary keys never fall back to the primary key. Set the expected currency to the actual upstream currency, not a guessed conversion currency.

The administrator POST endpoint selects only registered server connections. The reader verifies the upstream /ad_account identity and expected currency before querying insights; the existing date, timezone, coverage, precision and total checks remain. Request retries remain pinned to the original account/period. A query-string account ID cannot supply a new credential or a custom URL. No arbitrary endpoints or browser credentials are accepted.

## Background billing

The existing authenticated scheduler route uses the registered ready connections, processing up to two accounts in parallel per invocation, with a daily rotation for larger lists. Each job is still claimed for its exact account through SQL056, and each account has its own binding, opt-in, agreement, source, rates and job. A failure in one account does not prevent the other from being attempted. The multi-account response includes per-account states and no keys. The single-account response remains compatible with the installed scheduler and previous acceptance.

Connection enabled means reads are allowed. It does not enable monthly billing for a new client: the existing verified company binding and monthly opt-in must be completed first. Disabling monthly preparation should use the existing database-backed setting so outstanding leases are revoked; merely navigating or changing a selector never changes activation. With more than two accounts, later invocations service the remaining accounts; a once-daily tick is not a claim that ten accounts will all be processed on day one. Adjust cadence only after capacity/hosted acceptance is reviewed.

## Remaining acceptance

No hosted secrets, IDs, database records, schedule, permissions, Production deployment or existing Kenny configuration were changed. Brianna's actual ID and key have not been provided or tested. Next: configure the real secondary account privately, read metadata/zero activity, confirm the actual company, verify both accounts' source/draft isolation and run the existing worker with separately approved billing settings. No-consumption is valid only when upstream period/coverage confirms it; absent data or account periods before creation are not assumed zero.

Local tests verify registry validation, secret-free selector metadata, preserved primary behavior, missing-key failure, upstream identity rejection, server routing, two-account scheduler behavior and failure isolation. Build/typechecks are separate from hosted connection acceptance. The other priorities in ADMIN_AUTOMATION_AUDIT_2026_11_26.md (onboarding, commission draft automation, further UI separation) remain subsequent stages, not represented as delivered here.
