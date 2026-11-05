# Replacement development plan

## Existing application
The unchanged `/workspace/kbjmcorp.com` checkout contains Vite entry points `index.html`, `src/main.jsx`, React Router routes in `src/App.jsx`, six pages in `src/pages`, shared components, translations/content in `src/data/siteContent.js`, and a browser contact service. Its Tailwind 3, Vite config and SPA rewrite are not carried into this application.

## Initial implementation
- Next.js App Router, strict TypeScript, Tailwind 4; CSS-drawn artwork, no external fonts/assets.
- `/` redirects to Simplified Chinese `/zh`; `/en` is English. Localized document language, metadata, services, process, inquiry form and validation feedback.
- Responsive marketing page with keyboard focus states, skip link, reduced motion support and no unverified client/ROI claims.
- Server-only inquiry API validates input, bounds request bodies, checks browser origin, and writes to Supabase only when configured. No simulated success.
- SQL architecture for inquiries, internal CRM and tenant-isolated future client reporting. No database has been provisioned or migrated.

## Next phases
1. Review copy, legal entity details, privacy notice and design with owner.
2. Approve and provision a separate Supabase project in an agreed region. Review and apply migration; test RLS with two organizations and anonymous users, backups and retention. No existing database should be reused automatically.
3. Configure server-only environment credentials securely; verify successful persistence and operational alerts. Add persistent rate limiting and bot verification before publicly enabling inquiries. Add consent/retention policy and deletion procedures before collection.
4. Implement Supabase Auth client accounts with invite-only onboarding and controlled membership management. CRM access requires a separate staff authorization model; client roles do not grant staff privileges.
5. Add advertising integrations using encrypted server-side OAuth credentials and scheduled idempotent ingestion. Dashboard data is read-only for clients. Store daily metrics with currency; do not sum spend across currencies without explicit conversion. Document provider timezone and attribution definitions.
6. Owner-approved replacement, followed by smoke tests and rollback readiness.

## Database boundary
`inquiries` is private intake; `crm_contacts` and `crm_opportunities` are private internal sales data. `organizations` and `memberships` define client tenancy. `ad_accounts`, `campaigns` and `campaign_metrics_daily` support future read-only reporting. Composite foreign keys prevent linking campaigns/metrics across organizations. All tables have RLS. Authenticated users can select only their own memberships and organization reporting; no browser writes are allowed. Service-role bypasses RLS and must remain server-only. Roles are reserved for future controlled administration, not currently exposed as write permissions. No ad-provider tokens belong in public tables. This architecture remains unvalidated against a live database.

## Vercel settings — only at approved replacement
Keep the existing Vercel Project identity and repository association.
- Framework preset: change Vite → Next.js.
- Build command: `npm run build` (unchanged if already set).
- Output directory: clear explicit `dist`; use Next.js framework default.
- Install command: `npm ci` with this application's lockfile.
- Root directory: use repository root when the replacement is eventually placed at root.
- Remove the old `vercel.json` SPA-to-`index.html` rewrite from the approved replacement tree; this workspace intentionally has no such rewrite.
- Use a compatible Node version (validated here on Node 24).
No Vercel settings have been changed. Do not change domain binding, DNS, SSL, email, production branch or integrations during initial development. Supabase credentials belong in server environment settings only after approval.

## Clean history / replacement strategy
This directory was initialized independently on `next-rebuild`. Its first commit is an independent root, equivalent to an orphan branch; it inherits no old website history. The owner subsequently authorized publishing this new branch to the existing GitHub repository for preview. Publication uses a normal non-force push to this branch only. The original main history is preserved.

The owner authorized GitHub publication for preview, not a production replacement. Verify branch availability, create the independent root commit here, and add the existing repository as origin without changing the original checkout. Push only `next-rebuild` with an ordinary non-force push. Never force-push, reset main or delete old branches. Vercel Preview can deploy this branch using its own Next.js `vercel.json`; do not change the existing project's Production Branch or promote the preview. A normal merge into main would preserve old ancestry, so a clean production lineage requires a separately approved replacement strategy. Keep main as the rollback reference. See `VERCEL_PREVIEW.md`.

## Initial validation evidence
- Installed dependencies and generated `package-lock.json` in this isolated workspace; Next.js 16.4.5 and React 19.3.1 resolved.
- `npm run typecheck`: passed.
- `npm run build`: passed using Webpack. Turbopack hit cloud local-worker restrictions; development/build scripts explicitly select Webpack.
- Started production server on port 3000. `/zh` and `/en`: HTTP 200, expected translated content and correct document language. `/`: redirects to `/zh`.
- Unsupported locale and unknown route: HTTP 404.
- Inquiry API: invalid payload HTTP 400; valid payload without Supabase configuration HTTP 503.
- No live database, successful inquiry persistence, RLS integration tests, browser visual review or advertising integrations were validated.
- Original checkout remained clean after implementation.

## Development iteration 2
- Added eight localized service detail routes (four services × two languages), linked from the homepage with page-specific metadata and language switches that retain the current service.
- Extracted shared header and footer; all pages link back to the correct localized inquiry form.
- Added bilingual privacy development drafts, excluded from search indexing, with explicit outstanding legal/privacy decisions. These do not replace a final reviewed policy.
- Added a privacy link to the form and a duplicate-submit guard while a request is pending.
- Added `scripts/smoke.mjs` and `npm run test:smoke` covering localized routes, service links, language switches, 404s, body-size rejection, invalid JSON, consent, email validation, honeypot, content type and cross-origin requests.
- Production build passed. Against the running production server on port 3001, `SMOKE_EXPECT_UNCONFIGURED=1 npm run test:smoke` passed 25 checks. Live database persistence and browser visual/interaction review remain untested.

## Mainland China client direction
The owner specified mainland China advertising prospects as the primary audience, Simplified Chinese as default, English as secondary, and mainland mobile-number/SMS OTP as the primary customer login method. See `PHONE_AUTH.md`. Login pages and header links are implemented as explicit interaction previews; actual SMS, Auth sessions and authenticated client dashboards remain unimplemented. Existing infrastructure remains untouched.

## Authorized phone-auth implementation
After the owner's explicit development authorization, the isolated replacement gained Supabase SSR phone OTP endpoints, CAPTCHA UI, persistent rate-limit SQL, protected bilingual account pages and logout. The earlier preview-only limitation is superseded at the code level; the feature remains disabled because external configuration is absent. See `PHONE_AUTH.md` for exact activation requirements and boundaries. No hosted database migration, real SMS send, production configuration change or push has been performed.

### Phone-auth verification results
- `npm test`: 35 tests passed across five files: route validation/provider doubles, DOM interaction, official SSR cookie/session/logout behavior, executed PostgreSQL RLS/rate-limit policies, and Next listener/public-origin handling.
- `npm run build`: passed, including TypeScript and the session-refresh proxy.
- Built application started on port 3004; `SMOKE_BASE_URL=http://127.0.0.1:3004 SMOKE_EXPECT_UNCONFIGURED=1 npm run test:smoke`: 31 checks passed, including both protected account redirects and invalid auth payloads.
- A smoke test exposed a listener-host/public-origin mismatch; fixed and covered by regression tests before the final passing run.
- No hosted Supabase, actual CAPTCHA network, real handset SMS delivery, or live authenticated dashboard data was validated. No external accounts, databases, provider spending, pushes or deployments were created.

## Mainland client experience iteration
- Added a localized mobile navigation disclosure with destination links, Escape-to-close, focus return and outside-click dismissal.
- Added six bilingual FAQ entries addressing first overseas campaigns, budgets, AI limitations, account permissions, reporting availability and inquiry follow-up. No client results or guaranteed outcomes are invented.
- Reworked inquiries to accept an 11-digit mainland phone number or email, with a target-market selector, localized inline errors, focus on the first invalid field and duplicate-submit protection. Phone contacts are normalized to +86 on the server; inquiry submission never sends SMS or creates an Auth account.
- Added `003_inquiry_contacts.sql` for nullable email, validated phone contacts, target markets and a database contact-method constraint. Apply after migrations 001 and 002 in the separately selected project. No hosted migration has been run.
- `npm test`: 50 passed. Production build including TypeScript: passed. Running-server checks: 33 passed. Chromium: 7 scenarios passed across 320, 375, 768 and 1440px widths, including no horizontal overflow, mobile menu navigation, FAQ interaction, localized validation and retention of a phone inquiry after a real local 503 response. No uncaught browser errors were observed.
- Mobile and desktop screenshots were captured locally and visually reviewed. These checks establish local rendering and interaction, not mainland mobile-network reachability, hosted database connectivity or actual SMS delivery.
- The owner requested continued development; production/main replacement has not been performed as part of this iteration. Publishing updates to the already authorized next-rebuild preview branch preserves its independent root history.

## Owner reference-image visual update
- Replaced the public header/footer KBJM wordmark with the reference-inspired 智点未来 / AI 广告服务 lockup, retaining KBJM as corporate attribution in the footer.
- Added a reusable SVG AI mark, dotted globe, green orbital motif, white background, pale green halo, sweeping background arcs and bottom waves. The SVG is an approximate reconstruction from the supplied screenshot, not an original logo asset or a claim of pixel-exact reproduction.
- Retained the previously approved Chinese ChatGPT advertising copy and English counterpart. The reference image guides presentation; it does not silently replace that approved wording.
- Added separate phone/tablet layouts and a browser assertion that the hero artwork does not overlap the copy.
- Production build including TypeScript passed; 33 existing running-server route/API checks passed; final Chromium run passed 8 scenarios across 320, 375, 768, 1024 and 1440px widths. Desktop/mobile screenshots were visually reviewed. No hosted deployment or real SMS was validated.

## Requested six-part brand and service revision
- Removed the public KBJM attribution from the inquiry consent and footer, and replaced residual public page titles/labels with 智点未来. Repository identity and infrastructure remain unchanged.
- Added Global / 全球 consistently to inquiry choices, shared validation and persistence. `004_global_inquiry_market.sql` extends the database constraint after migrations 001–003; it has only been executed in the local test database.
- Removed the hero contact CTA in both languages, retaining the service exploration link and contact section.
- Replaced the hero agency-logo lockup with a ChatGPT-centered platform card featuring advertising strategy, creative expression and performance insights. The OpenAI symbol is hosted locally from the pinned Simple Icons v13.0.0 SVG, with source attribution and CC0 license retained. No partnership, endorsement, fake metrics or live integration is asserted.
- Replaced overseas growth strategy with brand growth strategy on the homepage and detail page, including positioning, audience, communication and measurement content.
- Rewrote the three service-experience stages around clear service scope, efficient ChatGPT-centered delivery and a unified customer information view. The customer-center integration is described as forthcoming, matching actual development status.
- `npm test`: 52 passed. Production build and TypeScript passed. Existing running-server checks: 33 passed. Final Chromium run: 9 scenarios passed across six widths (320/375/768/1024/1201/1440), including logo loading, absent legacy branding/CTA, Global selection and non-overlapping artwork. Desktop/mobile screenshots were visually reviewed.
