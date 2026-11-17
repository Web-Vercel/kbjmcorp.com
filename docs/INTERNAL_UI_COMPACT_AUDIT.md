# Internal menu compact UI audit — Preview

Scope: the system administrator's actual grouped navigation in `src/lib/operations/workspace-navigation.ts`, plus its drill-downs. This is presentation work only. No endpoint, database query, authorization condition, amount, posted record, financial state transition, form field name/default/validation, or consent has been changed. No SQL is required.

## Common presentation

`InternalDensity.module.css` is mounted only by the authenticated, non-demo `AdminShell` content container. It applies to internal management and operations pages; it is not mounted by external client/agent portals or public marketing pages. Existing feature-specific metric/card layouts are retained. Tables and list rows have tighter vertical spacing, filter labels align with controls, form labels have less excess space, nested definition-list groups lay out correctly, and empty status-message slots do not consume space. Buttons retain a 44px minimum height.

`InternalRecords.module.css` provides explicit compact headers, amount groups, details, and opt-in two-column forms. Textarea explanations, checkboxes/consent, form notices, buttons and result messages remain full-width. Forms stack on narrow screens. It does not automatically rearrange every financial form.

## Menu coverage

All 27 top-level entries (including work overview) were inspected in source and their shared rendering paths. “Retained” means no additional feature redesign was needed; the internal-only baseline still applies.

| Group / entry | Result |
| --- | --- |
| Work overview | Retained actionable/waiting/error reminder cards and unavailable states; tightened ordinary list/table spacing. |
| Inquiry leads | Retained compact table/filter and detail split; company values explicitly marked. |
| Client CRM | Removed exactly duplicate legal/display name in list only; compact opt-in company/contact/contract entry forms; profile/authorization/finance tabs and original fields retained. |
| Business applications | Submitted contact/company details start open for review; completed applications default to folded contact details. Goals, customer feedback, status, access disclaimer and review controls stay visible. |
| Advertising projects | Company/name/budget/current status visible; status editing folded; new-project fields paired on desktop. Project collaboration/history preserved. |
| Service requests | Internal-only compact ticket list and messages; status dots, replies, exports, reopen behavior, errors and client-visible warnings unchanged. |
| Advertising account management | Retained approved left identity/right read-history layout and truthful test/unknown states. |
| Platform data sync | Retained compact source/account configuration, separated company identity, diagnostic details and explicit errors/test-copy notices. |
| Manual account ownership links | Paired ordinary fields; confirmation remains full-width. Existing manual/unverified ownership semantics unchanged. |
| Advertising data and evidence | Retained account/version grouping, per-version downloads, differences, warnings and provenance. No versions merged. |
| Manual platform reports | Paired ordinary registration fields; file fingerprint and notices span full width; saved original reference/version behavior retained. |
| Monthly completeness checks | Account/date separate, spend/impressions/clicks in parallel metrics; long source IDs and SHA-256 folded. Evidence text, review note, eligibility exceptions, status and independent review remain visible. |
| Month close | Retained seven-stage route, responsible role, actionable next step, current balance, funding exceptions, statement questions and client handoff. |
| Pricing | Retained compact calculator, quote total/version history, immutable revisions and administrator-only private costs. |
| Monthly settlements | Retained amount cards, fee/review details, rejected-history folding, publishing guards and visible fictional notices. |
| Bank collections | Retained company/date versus amount/status header, receipt details, fictional notices and independent review. |
| Posted fund summary | Retained pending metrics, compact ledger, original descriptions and explicit monthly-read error. This audit does not claim that the earlier hosted monthly-query failure is resolved. |
| Client funds reconciliation | Retained four metrics, zero-entry state, CSV, Vancouver posting month and closed-month restriction. |
| Manual reconciliation drafts | Source/FX/fee references grouped in details; amounts/status and review controls remain visible. |
| Balance refunds | Retained compact three-metric wallet summaries and staged review/payment controls; no automatic payment or commission adjustment. |
| Intercompany procurement | Retained total/count summary and folded statement fee breakdowns. |
| Intercompany receipt verification | Retained amount/status, allocation table, evidence details, independent review/reversal controls and no-transfer test notice. |
| Agent management | Checked overview, clients/referrals, commissions, settlements, files and settings. Existing compact cards/facts/progress retained; internal settlement ID folded. The external agent page markup for that identifier is unchanged. |
| Business account access | Identity/email/company and active/paused status stay visible; pause/resume reason/confirmation forms folded. Credential maintenance errors/locks and fresh-session warning retained. |
| Staff responsibilities | Retained ordinary role changes in details; active operators, authorization confirmation and unit/role validation unchanged. |
| Project collaboration access | Full user ID and revocation action folded separately; company/role remain visible. Revocation still needs its original confirmation. |

Drill-down review also included inquiry details, CRM profile/contact/access/finance/contracts, contract documents/status forms, project workflow, source evidence, linked billing tickets and agent subnavigation. Printed contractual/report documents, public homepage, authentication screens and archived demos were not redesigned.

## Verification

- Existing page/role/form regressions: CRM, applications, operations, monthly coverage, agent workspace, client refund routing, internal navigation, project workflow, service tickets/replies and access pages.
- 113 existing regression tests passed; one pre-existing skipped case remains skipped. A stale test that expected the retired Preview demo link was corrected to assert its absence and the retired layout’s not-found behavior.
- TypeScript and optimized Next build passed.
- Representative actual page components rendered locally with explicit fictional fixtures (projects, CRM and applications), Chinese and English, at desktop 1440px and mobile 390px. All 12 combinations passed document/control overflow checks with details expanded. Screenshots inspected for desktop projects and English mobile application review. CSS module classes were isolated in this harness to avoid fixture-only name collisions. No hosted data was read or written.
- Artifacts: `/workspace/shared/internal-audit-{projects,crm,applications}-{zh,en}-{desktop,mobile}.png`.

This is not a claim of authenticated browser traversal or live business-state acceptance for every hosted page. Live account sessions remain with the owner; Preview deployment readiness must be checked separately. Existing financial acceptance records are unchanged. Keep the owner's untracked `PRODUCTION_STAGED_ROLLOUT.md` out of the commit.
