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
