# KBJM AI advertising — isolated replacement

Next.js / TypeScript / Tailwind website for mainland China advertising prospects. Simplified Chinese is the default; English is secondary. The original Vite checkout and production deployment remain untouched.

Requires Node 24 and npm. At `/workspace/kbjmcorp-next`:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run dev -- --port 3000
```

Routes:
- `/` → `/zh`; English `/en`.
- `/{zh|en}/services/{strategy|creative|media|insights}`.
- `/{zh|en}/login`: mainland phone + SMS OTP.
- `/{zh|en}/account`: authenticated, tenant-scoped client center; reports are still in development.
- `/{zh|en}/privacy`: development draft requiring final review before collection.

Phone authentication has real Supabase integration code and is disabled until configured. No SMS or accounts are created in the unconfigured environment. Follow `docs/PHONE_AUTH.md` for the separate Supabase project, migrations, provider, CAPTCHA, runtime configuration and actual-device acceptance tests. Never expose service-role or HMAC secrets to the browser or commit their values. The inquiry API also returns 503 without database configuration; it does not simulate success.

Functional regression checks (start the built app on port 3001 first):

```sh
npm run build
npm run start -- --port 3001
# Another terminal, targeting an unconfigured local instance:
SMOKE_EXPECT_UNCONFIGURED=1 npm run test:smoke
```

Omit `SMOKE_EXPECT_UNCONFIGURED` for a configured environment to skip the valid inquiry submission. Set `SMOKE_BASE_URL` to target a different local port. The smoke suite makes no valid SMS/OTP request; `npm test` uses provider test doubles and local PostgreSQL, not real SMS.

See `docs/IMPLEMENTATION.md` for architecture, required Vercel build settings and the independent root-history strategy. The independent `next-rebuild` branch is used for GitHub review and Vercel Preview. Production and hosted database migrations remain unchanged. See `docs/VERCEL_PREVIEW.md` for viewing instructions.

The homepage now includes bilingual FAQ and mobile navigation. Inquiries accept a mainland phone number or email (at least one), plus a target market; this is independent of SMS sign-in. Apply all four SQL migrations in order before connecting hosted inquiry storage.

Real-browser checks use the environment's installed Chromium:

```sh
SMOKE_BASE_URL=http://127.0.0.1:3001 SMOKE_EXPECT_UNCONFIGURED=1 npm run test:browser
```

`CHROMIUM_PATH` can select another installed Chromium executable. These checks run against a local built server, verify four screen widths, and write screenshots under `/tmp`; they do not validate mainland network access. Omit `SMOKE_EXPECT_UNCONFIGURED` to skip valid inquiry submission when checking a configured instance.
