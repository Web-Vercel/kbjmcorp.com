# Saved-record read-back audit — 2026-11-17 (Vancouver)

Scope: source-level review of all 27 internal menu entries (including overview), drill-downs, shared save components, plus client, sales and agent save flows. This is not an authenticated browser traversal of every hosted feature. Previous hosted evidence covers only 23 V3 read checks and selected customer isolation probes. No hosted write, SQL execution, deployment or publication occurs in this change.

## Rule

A successful save must lead to a persisted, permission-scoped record, current settings or version history. Form text left in memory is not persistence evidence. Current rules are distinct from the rule snapshots saved on transactions. A failed read is not an empty record; unknown financial writes must not be retried automatically. Passwords, MFA seeds and tokens remain non-retrievable; show maintenance target/reason/status instead.

## Gaps fixed

1. Refund wallets: show current fee, expandable full terms and rule ID. Existing per-refund policy snapshots remain separate. Administrator fee-version history is read via 048.
2. Manual account links: same-page saved company/account/platform-ID list with original unverified semantics, IDs, error and limit states.
3. Staff duties: expandable complete saved units, duties, active and revoked states; does not grant/revoke anything.
4. Agent settings: saved identity/agreement explanation and revision visible without submitting the pause/enable form.
5. CRM invitations: saved business access, finance scope and authorization reference visible alongside expiry/status.
6. Business-account access: saved authorization/status reason, changed time and current revision visible.
7. Legacy fee-rule drafts: rate, fixed/minimum amount, basis, zero-waiver and note visible; remain inactive reference drafts.
8. Partner finance saved explanations: administrator can revisit earlier assignment, refund, commission, settlement and payment explanations even when a later status replaced the live row's latest note. Finance personnel can revisit only their own explanations. No raw request JSON is returned. 048 exposes only an allowlist of action labels, notes, record IDs and times; current state is still read from the existing workflow.
9. Quote archive/restore and advertiser access pause/resume: existing saved audit notes visible to the existing administrator-only callers. Handoff notes also visible on the owner source page.
10. Account credential maintenance: administrator read-back of saved targets, reasons and statuses. No passwords or MFA data returned/rendered. Reconciled is not presented as proof an uncertain operation succeeded.
11. Client payment notices: unified external landing page now links to the wallet's persisted notice register; receipt/unknown-result links resolve to that register rather than a missing local anchor.

## Menu-by-menu coverage

| Internal destination | Persisted read-back location / result |
| --- | --- |
| Work overview | Derived tasks with underlying-record destinations; no independent save form. |
| Inquiry leads | Inquiry detail: saved status, original inquiry and internal-note timeline; converted CRM link retained. |
| Client CRM | Company profile reloads saved values, contact cards, contract details and finance records; invitation scope/evidence added. |
| Business applications | All-status filter, saved applicant data, feedback, revision and resulting CRM link retained. |
| Advertising projects | Saved name/company/budget/status, versioned brief/creative and project activity retained. |
| Service requests | Saved subject, messages, replies, status and exports retained; customer-visible boundaries unchanged. |
| Advertising account management | Existing saved company/account links retained. |
| Platform data sync | Saved binding/evidence/versioned source retained; handoff and access-change explanations added. |
| Manual account ownership | Added same-page saved association list. |
| Advertising data and evidence | Handoff records, saved explanations, per-version provenance/download retained. |
| Manual platform reports | Saved reference, period, currency, timezone/language, amount, hash, version and correction feedback retained. |
| Monthly completeness | Saved coverage classification, amounts, evidence, note and independent review retained. |
| Month close | Derived status with original records and month/account scoped destinations; no separate save. |
| Pricing | Load saved immutable quote version; archive/restore explanations and full legacy rule fields added. Administrator private FX/cost restrictions retained. |
| Monthly settlements | Draft amount/source/quote/agreement/note/review and published bill retained. |
| Bank collections | Receipt date/amount, payer, bank reference, receiving account, evidence and review retained. |
| Posted fund summary | Posted entries, original descriptions and downstream register links retained; query errors explicit. |
| Client funds | Selected month/ledger/linked statement and CSV retained; query is not a saved business mutation. |
| Manual reconciliation drafts | Saved source/FX/fee references, amounts, revision and review retained. |
| Balance refunds | Current rule/full text/version history and older handling notes added; refund snapshots/stages retained. |
| Intercompany procurement | Posted statements, fees and source links retained; no independent save here. |
| Intercompany receipts | Saved receipt/allocation/evidence/review/reversal versions retained. |
| Billing questions | Linked saved tickets, status and message threads retained. |
| Agents (all subpages) | Assignments/rules/periods, referrals, commission snapshots/reviews, settlement items, payment records and private files retained; identity/agreement and older processing notes added. |
| Business account access | Current identity/role/company/state plus reason/revision and credential-maintenance log added. |
| Staff responsibilities | Saved active/revoked unit and role details added. |
| Project collaboration access | Existing company/user/role membership list retained; revocation removes access rather than inventing a still-active membership. |

## External-role review

- Client refund submissions retain their fee snapshot, reason, money and workflow status. Current fee agreement is already visible inside the application form. Internal processing notes/old rules are not added to client output.
- Client applications retain submitted data, feedback and revision through the application page.
- Client payment notices already persist in the account wallet register; fixed landing-page discoverability/anchors.
- Client/sales service replies and statement questions retain message threads. Sales follow-ups append to the assigned company's profile notes.
- Brief/creative submissions retain versions and review feedback; statements retain read confirmation.
- Agent referrals retain submitted explanations and review notes, file uploads retain private-file links, commissions/settlements retain current records. Internal identity/authorization/payment evidence remains private.
- Password and verification-code inputs intentionally have no reveal-history feature. Credential logs display only safe existing operation fields.

## Database and release boundary

New `048_saved_partner_history.sql` is read-only. It neither changes a fee/assignment/state nor seeds data. Uses existing MFA, credential-session and active finance/admin guards. External clients, agents, investors, sales and unverified/revoked sessions are denied. Non-administrator staff see only their own notes; fee-policy versions are administrator-only. Inputs limited to 500 record IDs; notes and policy versions each capped at 1000, with visible truncation. UI also filters returned IDs to the requested scope.

Apply 048 only to the designated Preview database as a separate reviewed upgrade when deploying this feature. Do not rerun old migrations or the full new-project bootstrap against an existing database. Without 048 the new history panel explicitly reports unavailable; existing workflows remain readable. No stored values are reconstructed from unsaved form state.

Current columns store only the latest access/agent explanation; older action notes are recovered where the existing immutable partner-action or audit history exists. This audit does not fabricate deleted/never-recorded historical inputs, assert unlimited retention, or add replay buttons for financial writes.

## Verification completed

- 16 focused test files: 88 tests passed; 1 existing opt-in visual-artifact test skipped.
- Real local PostgreSQL-compatible migration tests apply through 048 and check current/history fee versions, administrator versus own-note access, external-role rejection, AAL1/paused/credential-locked denial, scope limits and raw-payload exclusion.
- Page tests cover saved rule amounts, manual associations, revoked staff roles, invitation scopes, agent agreement, history unavailable states, safe credential log rendering and client payment-notice navigation regressions.
- TypeScript check, generated bootstrap consistency and diff whitespace checks passed.
- Optimized Next build passed. Restricted sandbox build initially failed on a TypeScript child-process config read; the local build succeeded under approved execution outside that sandbox. No application build settings or validation was disabled.
- No hosted functional/visual acceptance of the new panels is claimed. No git push, environment publication or hosted migration was performed.
