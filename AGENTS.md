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
