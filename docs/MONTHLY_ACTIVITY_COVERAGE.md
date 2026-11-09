# Calendar months, activity dates and confirmed zero usage

Migration: `026_monthly_activity_coverage.sql` after 024/025. SQL Editor name: **22 整月活动覆盖与零使用核实**. It adds immutable coverage evidence/review records and a private resolution function, and updates the source projection, preparation and publication RPCs. It does not change raw API snapshots or post any money by itself.

A natural-month statement includes all actual usage during that month, whether advertising ran every day, one day or one hour. Daily API row presence is not itself proof of activity coverage. Empty/failed reads are not equivalent to zero cost. Original `daily`, `missingDates`, period bounds, raw responses and source fingerprints remain intact.

## Automatic reconciliation

The read adapter requests the official `includes[]=zero_impression_items` expansion for unsegmented ad-account insights. [Official Insights reference](https://developers.openai.com/ads/api-reference/insights), checked 2026-11-09, describes zero-impression entity rows in the requested window; it does not promise one row for every inactive day.

The database validates a closed CAD calendar-month request, unique valid in-range daily dates, nonnegative exact spend and count values, and an accurate missing-date list. When a full-month period total has verified requested boundaries, and its **spend, impressions and clicks all equal the sums of every paginated daily record**, omitted dates can be resolved as zero for those nonnegative metrics. Explicit zero monthly totals with zero counts and no daily rows qualify. A clipped period start, unavailable total or unverified end label does not qualify merely because amounts agree. Legacy complete daily records retain their existing strict full-coverage path; present period count discrepancies always block readiness.

The resolver builds a separate complete-month calendar with per-day origin `api` or `aggregate_zero`. It never fills or overwrites the raw API arrays. This calendar is used for settlement and labelled reports. Amounts stay in exact millionths and the entire monthly source is rounded once to CAD cents for matching the quote.

## Independent official-evidence review

For structurally valid sources whose monthly coverage is uncertain, an administrator/scoped finance preparer opens `/zh/operations/source-checks` and registers:

- the actual full-month classification: activity with verified inactive dates, an active account with zero usage, or an account not active during the month;
- matching official full-month spend, impressions and clicks (locked to observed source sums; discrepancies require corrected source collection);
- the official monthly report or actual activation-record reference, its SHA-256, and the explanation of missing dates;
- for an inactive account, a verified activation date after that month and not in the future.

The fingerprint widget reads PDF/CSV bytes locally (25 MB maximum) and sends only the fingerprint, not document contents. A fingerprint identifies a file; it is not proof of authenticity or correctness. Original records stay with the operating companies and must be available to the independent reviewer. This workflow records a human verification, not an API-certified zero.

Another active MFA finance reviewer/admin independently checks the evidence. Authors cannot review themselves. Decisions are immutable, exact retries are idempotent, and a snapshot can have at most one approved proof. Rejected evidence can be corrected with a new request, preserving history. Wrong approved evidence requires a new source version and controlled correction; it cannot silently replace an existing financial source or published statement. Amount/metric differences cannot be approved away.

The resolver marks manually supported days `reviewed_no_activity` or `not_active`, pins the approved proof ID into the prepared settlement and rechecks it at publication. The existing separate financial review, administrator publication, wallet-funds check, account/month deduplication and atomic ledger checks remain mandatory.

## Reading and billing

Finance source reports and CSV/HTML exports distinguish original rows, aggregate-verified zeros and independently reviewed inactivity. Unverified gaps remain blank/unknown. Coverage status is separate from the original API check status. Published client statements include only the activity classification and daily usage basis, never private file evidence, raw responses, FX or procurement costs.

Zero advertising spend does not dictate the total bill. Existing fee rules determine whether a fixed/minimum fee applies or is waived at zero basis; a verified fee agreement and independent settlement review are still required. An inactive account is labelled as such, rather than presented as having run advertising. Coverage approval alone does not create a bill or debit. Failed API calls without a stored source cannot be treated as zero-use snapshots.
