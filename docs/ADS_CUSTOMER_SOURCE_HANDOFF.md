# Explicit advertiser ownership and internal source handoff (021)

Apply `supabase/migrations/021_ads_source_handoff.sql` after 020 in the selected backend. Suggested SQL Editor name: **17 广告账户归属与来源交接权限**. This adds no scheduler, customer permissions, published reports, fee calculation or ledger entries.

## Administrator workflow

Use `/zh/operations/ads-reporting` with MFA. After a successful source read:

1. Select the advertiser's actual authorized company and record an ownership/authorization reference. The form starts with an empty selection; never choose an unrelated fictional company simply to exercise the feature. Create the appropriate company in CRM first if absent. No user email or real account ID is seeded by this migration.
2. Confirm the destination. One advertiser identity has one immutable destination, consistent with the existing `ad_accounts` global external identity. A pre-existing account linked to another company is rejected. Repeated binding to the same company returns the existing record without overwriting its original evidence or changing paused access. Direct reassignment is intentionally unavailable; wrong ownership requires pausing access and a separately designed controlled correction, not a silent edit.
3. Select one saved source version and provide a handoff note. Confirm the company and source. Binding alone shares no history. Subsequent API reads remain private until explicitly handed off; the latest ten snapshots are available in this form.
4. Pause/restore internal handoff access with a reason. State revisions reject conflicting changes. Pausing denies future finance reads and further handoffs, without deleting evidence or changing client membership, published documents or balances. Data already seen by a recipient cannot be unseen. Restoring shows previously shared versions again.

## China finance view

Active authorized finance preparers/reviewers with MFA open `/zh/operations/source-data` (also linked from Operations), choose a company and read its latest 20 explicit handoffs. Existing operating-unit/company authorization determines scope; these are not per-individual customer assignments beyond the established unit model. Revoking the operating role immediately denies subsequent reads.

Only a whitelisted projection is returned: source identity, exact account-currency amounts, dates/timezone, daily metrics, source check status, missing dates, digest, timestamps and handoff note. Raw API responses, ownership evidence, secrets and private pricing are not returned. The raw source table and mapping/handoff tables remain administrator-only; ordinary clients and non-finance operators cannot use the projection.

Source versions can overlap dates and must not be added together as cumulative spend. This is not a monthly ledger or bill. Source pending/difference states remain intact; a manual comparison note does not turn them into programmatically matched or financially approved data. Human confirmation of the real API amount is evidence of the user's comparison, not automatic proof of missing-day or aggregate-boundary semantics.

## Invariants and limitations

Binding identity and source handoffs cannot be edited/deleted. Each snapshot can be handed off once, with its destination frozen through its binding. Same-note retries return the original handoff; changed evidence conflicts. Account mismatch, inactive mapping, non-admin write or missing MFA is rejected in SQL independently of HTTP checks. Account creation here records internal ownership and does not claim legal identity or OpenAI account-administration authority.

The feature does not create manual `ops_source_packets`, because a rolling seven-day window can span months and is not a complete monthly settlement report. It does not round micros into billed cents, run FX, publish client reports or debit wallets. A later scheduled ingestion stage must explicitly opt in and use these verified mappings; no unattended sharing is enabled here.

Validation uses embedded PostgreSQL for permission isolation, selective sharing, exact projection, idempotency, immutable history, pause/restore and revoked-role behavior. API/UI tests check confirmation, company placeholders and pending-state wording. Hosted migration/application acceptance still requires the administrator's explicit company choice and a separate finance-session read.

Account-ownership controls and saved-source history use the non-secret pinned account ID independently of whether API reading is enabled or the key is currently supplied. Disabling upstream reads does not itself revoke previously handed-off data; use the separate pause action to revoke future handoff reads.

## Source report CSV export

The authorized source-data view offers a per-snapshot CSV download. It uses only the existing finance-safe projection, never raw API bodies, credentials or private ownership evidence. The file includes account/period/currency/timezone, exact six-decimal source spend, daily records, reconciliation and date-boundary status, source fingerprint and handoff note. Missing daily rows have blank numeric cells and an explicit missing-data label; unavailable period totals remain blank. UTF-8 BOM supports Excel, and spreadsheet formula prefixes are neutralized in text fields. Export does not re-query upstream, approve data, publish a customer bill or alter balances. A downloaded copy persists outside platform access controls; later pausing access only affects future platform views.

The same per-version export controls also offer a self-contained HTML reading report. Open it locally in a browser and use the browser print dialog to print or save to PDF (this is not a server-generated PDF). A4 print styles, full daily rows including explicit missing rows, reconciliation notices, source identifiers, timestamps and notes are retained. All variable text is HTML-escaped, and the downloaded document has a restrictive CSP with no scripts, remote resources or forms. It is an internal report generated from saved data, not an OpenAI-issued report or invoice.
