# OpenAI Advertiser API: read-only acceptance

## Verified official contract (2026-11-08)

- Overview: https://developers.openai.com/ads/api-overview
- Authentication: https://developers.openai.com/ads/api-reference/authentication
- Insights: https://developers.openai.com/ads/api-reference/insights
- Reporting: https://developers.openai.com/ads/reporting
- OpenAPI: https://developers.openai.com/ads/openapi.json

Base: `https://api.ads.openai.com/v1`. Advertiser API keys use bearer authentication and are scoped to one ad account. A model API key or Conversions API key is not interchangeable. This application only issues GET `/ad_account` and GET `/ad_account/insights`. It implements no activation, budget, campaign, creative, billing, payment or access-management operations. This does not establish that the underlying key itself has read-only privileges.

Insights accepts `aggregation_level=ad_account`, daily/none/hourly/monthly granularity, inclusive account-local `date_range.until`, canonical `fields[]`, and forward `after` pagination via `last_id` while `has_more` is true. Canonical account delivery fields can serialize to flat `impressions`, `clicks`, and `spend`. The response declares count and cursor fields. General Insights documents a page limit of 1–2000. The adapter uses 100 rows, at most five pages per query, an overall timeout, a fixed host and paths, no redirects, and bounded response sizes. It does not assume Conversions API is the reporting API.

Non-hourly non-product reporting retains the most recent 365 days; hourly and product history are approximately 30 days. Recent delivery/spend/conversion values can change. Available time granularity does not imply reports are finalized. This first acceptance reads delivery counts and spend only, so conversion attribution settings do not affect its reported metrics.

## Activation steps

1. Apply `supabase/migrations/020_ads_readonly_reporting.sql` to the selected backend after the existing migrations. SQL Editor name: **16 广告API只读来源快照**. It adds an administrator-only immutable source table and save RPC; it does not post any wallet entries or map an advertiser to a customer.
2. In Ads Manager, select the explicitly authorized real advertiser account. Create a separate Advertiser API key in Settings → General → API Keys, where available. Keep the key out of chat, Git, screenshots and browser storage.
3. Configure these **server-only Vercel Preview** environment variables:
   - `ADS_REPORTING_ENABLED=true`
   - `ADS_REPORTING_API_KEY`: that account's Advertiser API key
   - `ADS_REPORTING_ACCOUNT_ID`: exact `adacct_…` ID of the authorized account
   - `ADS_REPORTING_CURRENCY`: optional expected account currency; leave unset to use the official account response, or set `CAD` only if confirmed
   Never use `NEXT_PUBLIC_` for these values. Leave Production unchanged. Redeploy Preview for environment changes to take effect.
4. Administrator with MFA opens `/zh/operations/ads-reporting`, confirms the read and selects “读取并保存最近七日广告数据”. Identity is compared to the server's pinned account ID before any Insights request. Currency comes from the official account response; an explicitly configured expected currency must also match. The actual returned account timezone determines the seven completed calendar days; today is excluded.
5. Verify returned name/ID, currency, timezone and date range against Ads Manager. Compare the same account-local dates and scope, not lifetime spend or a differently bounded invoice. The user's approximate spend is not a fixture or expected result. A month-boundary request is valid and does not force monthly settlement.
6. Check daily spend against a separately fetched period total. Missing daily rows remain explicitly missing, not zero-filled. Differences can arise while upstream data changes between reads and require another read/investigation. A match is a numerical check, not document authentication, financial approval or a finalized invoice.

If Cloud-local live testing is later required, its network policy must additionally allow the verified API host `api.ads.openai.com`; the documentation host alone does not permit API requests. The deployed Vercel application has its own outbound network configuration. No live API call is claimed until a successful authorized response is observed.

## Source integrity, amounts and access

Raw successful response bodies and exact request paths are retained privately with a SHA-256 digest. Error bodies are never returned, logged or saved. No API key is sent to the client or persisted in a snapshot. Configuration status means only that required values exist, not that a connection succeeded. Failed reads do not replace prior snapshots or masquerade as zero spend.

JSON numeric tokens are preserved as decimal strings before parsing. Spend is represented in integer millionths of the account currency, with exact BigInt sums. Unsupported sub-millionth precision is rejected rather than silently rounded. There is no cents rounding, FX conversion or customer billing in this adapter. Daily bucket bounds must be full local days (including 23/25-hour DST days); returned account IDs, dates and timezones are checked. Duplicate rows, cursor loops and incomplete paging fail closed.

Only active administrators with MFA can read/save these snapshots. Finance, customer-service, Canada operators and clients receive no access to this initial real-account acceptance store. Each request UUID yields at most one snapshot per administrator; replay returns the prior receipt without fetching upstream again. Reusing a UUID with changed stored data is rejected by SQL. Saved snapshots and audit trails are append-only. The digest proves byte consistency, not authenticity or finality; administrators controlling the database can originate internal records, which cannot be used as financial posting instructions.

History displays ten stored runs for the configured account. Source totals use six-decimal presentation and are not client balances. Only successful reads are stored; a failed attempt is shown in the form and does not count as a successful zero-data run. The stored snapshot time is the completion/save time; daily and total responses are fetched sequentially, not as a provider-atomic snapshot.

## Scope and next stage

This is an administrator-triggered, read-only connection acceptance feature, not an unattended scheduler. It deliberately has no automatic customer mapping, source-packet creation, report publication, fee calculation or ledger debit. The authorized real advertiser is not automatically associated with a Chinese test enterprise.

After live account and CSV comparisons pass, add administrator-approved per-account customer mapping and a separately authorized scheduled-worker credential. Then implement durable jobs, concurrency leases, retries/backoff, recent-date refresh, alerts, source revisions and reviewed publication. Real billing remains a separately approved workflow. CSV import remains a fallback, not the intended daily primary path.

## Validation limits

Provider-mocked adapter/API/UI tests and embedded PostgreSQL RLS/idempotency/audit tests cover failure handling, exact amounts, pagination, pinned identity, MFA, immutable snapshots and no ledger changes. They do not prove the user's account permissions, real endpoint availability, real totals, production readiness or scheduled synchronization.

## Configuration and timeout troubleshooting

When configuration is incomplete, the checkbox and action are intentionally disabled; this does not mean an upstream API read is running. The administrator-only page reports each variable as missing, disabled, invalid, optional or supplied, without showing key values. It also identifies the current Vercel environment, branch and short commit where available, so an old deployment can be distinguished from a redeployed one. Check Preview scope and any branch-specific override. Changes require a fresh deployment.

Surrounding whitespace is trimmed, the enable flag is compared case-insensitively, and currency codes are normalized to uppercase. Account ID syntax and identity pinning remain enforced. A supplied key is not proof of successful authentication. The browser stops waiting after 45 seconds and keeps the request UUID for retries; the server separately bounds API reads and database operations. A browser timeout can occur after a server write, so it reports an unknown save state rather than declaring failure or zero spend.

Currency configuration is optional. A missing expected currency no longer disables read-only acceptance; it is obtained from the pinned account response, not guessed as CAD or substituted from an agency wallet. An explicitly supplied invalid currency still blocks configuration; a supplied valid currency that differs from the API stops the read. This is only source-data retrieval, with no FX conversion, customer mapping or posting.

## Safe read diagnostics

Failed reads return an administrator-only diagnostic phase (account metadata, daily Insights, period total, validation, storage lookup/save), HTTP status when received, or a bounded network classification (timeout, DNS, connection, TLS, generic network). These fields are schema-whitelisted before returning to the UI. Provider response bodies, arbitrary error messages, request headers and key values are not returned or logged. Diagnostic phases identify where a failure occurred; they do not prove the underlying cause or establish that authentication succeeded.

## Period-total request fields

A hosted acceptance attempt reached the period-total phase and received HTTP 400 after account metadata and daily reporting completed. The period query now projects only account identity and delivery metrics, omitting daily-bucket metadata (`metadata.readable_time`, `metadata.timezone`). Both daily and total requests retain the identical account scope and explicit date range/timezone. A provider-mocked regression checks this request distinction. A successful hosted retry is still required to verify resolution; an HTTP 400 alone does not identify the provider's precise rejected field. No failed total is substituted with the daily sum or treated as a passed reconciliation.

Validation errors now distinguish decimal precision, timestamp/local-midnight boundaries, daily duplicates, total-range mismatch, timezone, account identity and ambiguous totals. Only bounded dates, local times, scale and enumerated reasons are exposed to administrators. Timezone aliases are compared through canonical IANA identities. `readable_time` is display metadata with an unconstrained string type in the official schema: dates are derived from timestamps; a returned ISO date label is cross-checked, while locale-formatted display labels are not treated as machine-readable dates. No timestamp boundary, amount precision or scope check is bypassed to accept an unknown response.

## Explicit timestamp windows

Hosted acceptance subsequently returned a period boundary one day earlier than the expected exclusive end (`2026-10-31 → 2026-11-06` versus `2026-10-31 → 2026-11-07`). Both query types now use the documented `unix_range` format with an explicit inclusive start and exclusive end, resolved at the account's local midnight. Each boundary is resolved independently to handle DST; no fixed 24-hour multiplication or host timezone is used. Returned daily and period boundaries remain strictly checked; an abbreviated period is not accepted or filled in. Tests cover Toronto's 169-hour autumn week, 167-hour spring week and a half-hour-offset timezone. Hosted retry is required to verify provider behavior with the explicit window.

Boundary resolution uses the runtime IANA timezone rules, not an assumed seasonal UTC offset for Vancouver or a fixed Canadian offset. A provider/runtime timezone-rule disagreement remains a validation failure rather than a silently adjusted report.

## Inclusive final-day aggregate labels

The hosted aggregate response continued to label the end at the final included day's midnight even after requesting an explicit exclusive Unix end. A label alone does not prove a missing day or full coverage. The adapter retains the original label and performs an additional, independently scoped last-day total request. It only recognizes an inclusive-day label when that single-day response also labels start=end at the requested day and matches the validated daily row's spend, impressions and clicks, with positive activity. The full-period spend must still independently equal the daily sum for a matched check. A shortened amount remains a difference; absent, zero-only, or inconsistent evidence leaves the end-label unverified and the snapshot marked `no_data` (coverage pending), never matched. Other wrong boundaries or identities are still rejected.

The JSON snapshot records `endBoundary` and retains the probe response and exact request. These are internal source observations, not financial approval. No new SQL is needed: the existing private JSON and matched/difference/no_data states accommodate the evidence. Historical snapshots without `endBoundary` remain readable. This compatibility must still be verified against the live account; mocked tests establish the intended acceptance/rejection rules only.

## Complete calendar-month source collection (migration 022)

Run `022_ads_calendar_month.sql` after 020/021 on the existing Preview database. Suggested SQL Editor name: `18 广告完整自然月来源读取`. This narrowly expands the immutable snapshot period constraint from seven days to either seven days or one complete natural month; it does not backfill, approve, share, publish or post money.

In the administrator Ads API page, choose **已结束的完整自然月**, select a month, re-confirm and read. Server validation uses the API account timezone and permits only closed months whose first day is within the last 365 days. Daily and period-total requests use the same exact local-midnight Unix boundaries, with the existing pagination, account pin, exact micro-unit amounts and end-boundary probe. Missing daily dates are never padded with zero; monthly snapshots with missing dates cannot be marked matched merely because their spend totals agree. The existing request UUID receipt cannot be reused for a different month or seven-day scope.

The monthly version still requires explicit handoff to the correct company; finance uses the existing source report and CSV/print export. Several seven-day sources must not be added together as a monthly bill. Collection is administrator-triggered; there is no scheduler yet. These are source snapshots, not an approved monthly statement or a balance debit. The next settlement stage must link a specific complete source version with agreed fee/FX terms, independent review and atomic/idempotent customer publication plus ledger posting. Monthly API reads have been verified with fixtures; the configured real advertiser must still be tested through Preview.

## Operational queries vs monthly settlement sources (023)

`023_ads_operational_periods.sql` permits 1–31 calendar-day snapshots without changing write grants, RLS, immutability or ledger behavior. It handles either the original 020 period constraint or its 022 replacement. SQL Editor label: `19 广告运营查询日期范围`.

The selector groups recent seven days, **本月截至昨日**, and **自定义日期范围** under operational queries; complete closed calendar months are separately labelled monthly settlement sources. Month-to-date uses the official account timezone, not browser/server timezone, and is unavailable on the month's first day because there are no completed days yet. Custom windows include both endpoints, permit at most 31 days, exclude today/future days, and must fit the preceding 365-day retention. They support investigations, not arbitrary billing or summing overlapping snapshots. Missing rows remain missing, not zero; non-weekly queries with missing dates cannot be marked matched solely by agreeing amounts.

New stored report JSON includes normalized `readSelection` metadata. A request UUID retry must match account and the original selection, including exact custom dates. A retry after the calendar day changes returns the stored receipt rather than silently rereading a shifted period. Existing weekly/monthly snapshots without the metadata retain compatible receipt checks. The projection and downloaded report retain actual since/until dates and existing reconciliation notices. Operational queries do not create a scheduler, balance alerts, statements, fee charges or wallet entries.
