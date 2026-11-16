# Project instructions

The user approved the existing public website as the visual and branding baseline. Extend business functionality without redesigning it. Read `docs/APPROVED_HOMEPAGE_BASELINE.md` before work that could affect public pages.

- Preserve the Chinese headline exactly: **让中国品牌，被世界看见。**
- Preserve 智点未来, logo, all existing homepage marketing copy and sections, green-and-white identity, typography, spacing, layout, hero/right-side visual, navigation appearance and language switcher.
- Do not substitute “Smart Clicks. Greater Futures. / 智能触达，成就更大未来”.
- Any technically necessary homepage content/layout change requires the user's explicit approval first. Backend and independent portal/application/admin development may continue within the existing authorization.
- Scope new UI styles to the new pages; shared global CSS and components can affect the approved homepage. Verify relevant public-page regressions.
- The user's Vercel screenshot confirmed `next-rebuild` triggers Production deployment. Do not push that branch or main. New work uses the isolated `preview/tenant-isolation` branch; any publication must target a separate non-production branch. Do not rewrite/force-push history or change domain, DNS, SSL, email, repository identity or Vercel project identity. Do not claim deployment readiness without evidence.
- Keep public fictional demos distinct from authenticated persisted workflows. Never present an unconfigured database, SMS, payment or advertising API as connected or a business write as successful.

## Authorized public platform additions — 2026-11-10
The user explicitly authorized four platform menu entries, homepage logos and slogans, and related service presentation for ChatGPT Ads, Google Ads, Meta Ads and TikTok Ads. This narrow exception permits the new platform rail, mobile links, homepage showcase and bilingual platform detail pages. Preserve the original headline, brand, hero and existing sections. ChatGPT remains the current focus; the other three offer consultation pending assessment. Preview only; no Production publication is authorized.

## Business workspace language — 2026-11-10
Use clear, concise business language in authenticated operational pages. Keep migration numbers, test-database setup and branch-specific deployment instructions in technical documentation rather than routine business prompts. Preserve accurate draft, review, publication, connection and payment states. Keep explicit fictional-data notices on demonstrations and actual acceptance/test modes; never hide those notices or relabel stored test records as real. Production versus Preview alone does not determine whether data is fictional.

## Demo roles and Production boundary — 2026-11-11
Investor demos are read-only. Customer experience and assigned employee training may only mutate fictional page-local data. Training completion must not grant real staff rights; real onboarding and authorization are separate. While a demo cookie is present, real workspace pages and real APIs must fail closed even if a real user session also exists in that browser. Keep demo exit available for expired or disabled invitations. Preserve independent preparation/review/publication in training explanations and real workflows.

## Real experience accounts and investor review — 2026-11-11
The owner authorized real persisted investor/client/sales accounts through unified business sign-in. Investor accounts may read business records across all companies, but never mutate data or access credentials, Auth users/sessions, invitation or authorization administration. Client and sales remain assigned-company only. Retire the old /demo entrypoints; preserve archived fictional code without presenting it as the real account workflow. Old demo cookies must still block real API actions until explicitly cleared through logout; unified login must remain reachable for cleanup. These instructions supersede the fictional-only restriction for the separately provisioned real client/sales accounts, not archived demo components.

## Homepage Partners section — 2026-11-12
The owner explicitly authorized replacing the homepage cooperation-process section and navigation label with Partners, using the supplied five partnership models, benefits, application CTA and agreement disclaimer. Bilingual updates and a partner-purpose application form reusing the existing inquiry endpoint are within this scope. Preserve the existing headline, hero, brand, service and platform sections. Preview publication only; do not publish Production.


## Static frontend Production release — 2026-11-12
The owner explicitly authorized publishing static frontend design and content to Production, and renamed the homepage/navigation Partners label to “合作模式 / Partnership Models”. This supersedes earlier blanket prohibitions on pushing the Production branch only for an isolated frontend release based on the current origin/next-rebuild. Do not merge the Preview branch wholesale: backend workspaces, APIs, auth, permissions, financial logic, analytics and SQL continue on Preview. Root branding/error-page presentation and public marketing/application-form presentation may ship; the existing production inquiry API must remain unchanged. Never force-push or alter deployment settings, environment variables, domains or DNS.


## Customer-focused homepage revision — 2026-11-12
The owner requested a quieter partnership presence and an honest customer-focused presentation of project progress, charges, receipts, permissions and reports. Add an illustrative information structure without fabricated account metrics; retain detailed partnership models on a separate public page. Preserve brand, headline and hero artwork. Prepare this revision on Preview for review; backend and Production remain unchanged by this iteration.


## Visual budget explanation — 2026-11-12
The owner requested replacing the lengthy customer-benefit copy with concise visual explanations of receipts, spending and records. Use accessible interactive schematic diagrams without fabricated monetary amounts or performance charts. Preview review first; retain the quieter partnership entry and existing brand.

## Concise customer service copy — 2026-11-12
The owner requested removing the budget diagrams in favor of short, clear text covering funds management, an integrated workflow, stakeholders' responsibilities and interests, and efficient campaign design. Replace only this customer section; no graphics or tabs. Avoid guaranteed returns or safety claims. Preview review first.

## Service sequence and partnership cards — 2026-11-12
The owner requested a logical sequence for services, management benefits and platforms, ensuring the Services navigation does not skip the management section. Order the homepage as Services → Customer management benefits → Advertising platforms; both the hero exploration link and Services navigation start at #services. Restore the five partnership models in the previous numbered text-card grid, with concise one-sentence summaries and understated links. Preview review first.

## Deferred online payments — 2026-11-15
The owner approved a staged payment design, not activation. Keep current manual receipt verification, refund requests, independent review, approval, offline payment registration and payment verification. Do not enable gateways, online top-ups, automatic refunds or customer-editable balances. Refund requests remain available; requests and approvals are not payments. Follow `docs/PAYMENT_EVOLUTION.md` for future design: online top-ups → original-payment refunds → additional customer self-service. Preserve immutable financial history, organization isolation, held funds, exact amounts and independent approval. Future activation needs a separate implementation and release decision.

## Backend visual hierarchy — 2026-11-15
Apply the approved concise partner-workspace style consistently across backend pages: retrieved names/amounts/dates use the scoped `data-workspace-value` marker (deep blue), explanatory copy uses neutral gray, status indicators retain their semantic colors and text. Keep headings compact and secondary explanations in native details. Never hide errors, financial consent, payment uncertainty, independent-review constraints or fictional/test notices for visual simplification. Shared presentation belongs in WorkspacePresentation and backend-only components; do not restyle the approved public site. Presentation changes do not change business rules, permissions or stored data.

## Restrained informational colors — 2026-11-15
The owner clarified that routine explanatory copy, test-record notices and lead confirmation labels should share the normal neutral text color. Highlight retrieved company/agent names and financial values in blue. Do not add yellow test-copy text or green lead-status pills merely for decoration. Keep test wording visible. This refines the earlier status-color guidance for ordinary partner information; existing financial progress indicators and actionable error signals are separate.

The restrained informational-color rule applies to all Preview backend workspaces, not only partner pages. Routine badges, folded-help labels and informational notices use neutral gray without decorative status fills. Table cells are not all “data”: explicitly mark names, dates and monetary values; keep status descriptions neutral. Keep existing financial progress indicators and actionable errors distinguishable, and leave the approved public marketing design untouched.

## Service request status dots — 2026-11-15
The owner explicitly requested colored status circles on both customer and internal service-request views: open yellow, in-progress blue, resolved green. Use the shared ServiceStatus component for lists, current detail and reply receipts. Retain status text so color is not the sole signal; routine explanations stay neutral. This narrow exception does not restore decorative colored pills elsewhere or change workflow states.

## Homepage tasks and reminders — 2026-11-15
The owner authorized role-scoped home reminders for administrators, finance preparers/reviewers, clients and agents. Keep actionable work separate from waiting and explicit exceptions; preserve independent review and company/agent isolation. Use existing authoritative workflow states, not fabricated overdue thresholds or unread-message claims. Query failures must remain distinguishable from empty queues. No emails, popups, background notification delivery or new payment activation in this stage. Reassess email/popup timing after home task rules and role isolation are stable, and proactively explain the proposed next stage to the owner.

## Homepage reminder visual emphasis — 2026-11-15
The owner requested immediate visual identification of actionable, exceptional and waiting reminders. Use scoped summary cards with distinct icons, restrained blue for actions, amber for actual exceptions and neutral gray for waiting. Empty categories stay muted and compact; only nonempty groups expand into details. Keep text labels alongside visual signals. No workflow, permissions, email or popup changes.

## Unified internal system and two portals — 2026-11-16
The owner authorized one business system with two sign-in portals: employees at `/admin/login` and external clients/agents/other authorized business roles at `/access/login`. Internal management and operations pages share one Business management center shell and role-scoped grouped navigation. Do not reintroduce separate centers or collection shortcuts beside an entire center. Preserve existing URLs, financial authority, company isolation, independent preparation/review and MFA. Keep explicit legacy application/document return verification compatible. See `docs/UNIFIED_BUSINESS_WORKSPACE.md`. Preview only.

## Administrator credential maintenance — 2026-11-15 (Vancouver)
The owner authorized administrators to reset passwords and change independently verified login emails for other managed clients, agents, investors/sales, internal employees and other administrators. Use the existing AAL2 administrator guard, a server-only Supabase Auth Admin SDK client and the audited maintenance state in migration 046. Preserve roles, organization scope, active/paused state, financial history and MFA enrollment. Never expose old passwords or store new passwords in application/audit data. Email changes must synchronize business/agent email pins. Preserve the credential session gate when changing staff/operating/client/agent authorization functions. Uncertain Auth writes must not auto-retry; maintain a lock until privileged reconciliation. Current-administrator self-maintenance stays in self-service recovery. Preview only; see `docs/ADMIN_ACCOUNT_MAINTENANCE.md`.

## Visible external identity and shared-browser sessions — 2026-11-15 (Vancouver)
The owner requested a visible current email/account label/role/company on external client and agent pages after ambiguous A/B screenshots. Use verified server identity, never a form email or wallet selection. Keep customer statements/wallets scoped to the authenticated database user. Account-change signals may invalidate other same-profile tabs without storing credentials; focus checks must not discard unchanged staff draft work. Browser-profile cookie sharing is a diagnostic possibility, not proof that hosted A/B isolation passed. Preserve distinct normal/Incognito-profile test guidance and record actual hosted outcomes separately from local regression tests. See `docs/PORTAL_IDENTITY.md`.

## Retired demonstration entrypoints — 2026-11-16 (Vancouver)
The owner requested removing legacy demonstration links and disabling old fictional preview route trees. Do not reintroduce demo entry links into employee login, client CRM or public application pages. Retain archived components only behind retired route layouts and keep legacy demo-cookie cleanup/logout and fail-closed real API checks. Existing client A/B isolation accounts and their fictional acceptance records must remain unchanged. Future external demonstrations use separately provisioned, role-scoped real accounts with fictional records. See `docs/RETIRED_DEMOS.md`.
