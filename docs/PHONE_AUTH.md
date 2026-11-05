# Mainland China phone authentication

## Product and implemented scope
Mainland China advertising prospects are the primary audience. `/` redirects to Simplified Chinese `/zh`; English remains secondary. `/zh/login` and `/en/login` implement a +86, 11-digit mobile-number flow. No email/password is required. The application now contains real Supabase request/verification/session code, but no live Supabase project or SMS provider is connected in this environment.

Implemented:
- `/api/auth/sms`: same-origin JSON requests, bounded bodies, mainland phone validation, explicit consent, mandatory CAPTCHA token, persistent database limits, and Supabase `signInWithOtp`. Requests use E.164 `+86…`; provider messages never reach the browser.
- `/api/auth/verify`: code shape/configured length checks, separate brute-force limits, Supabase `verifyOtp(type: sms)`, and official `@supabase/ssr` cookie persistence. No tokens are returned in JSON.
- `/api/auth/logout`: same-origin POST with local-session sign-out.
- Frontend: CAPTCHA, OTP autofill, pending-request lock, localized failures, resend cooldown, changing number and navigation after verified login. It shows “request accepted” only after provider acceptance; this does not prove handset delivery. No OTP entry or fake countdown appears after a failed send.
- `src/proxy.ts`: session refresh before protected Server Components; private/no-store responses. Cookies are HttpOnly, SameSite=Lax and Secure in production. This is a server-only auth architecture, not browser-localStorage authentication.
- `/zh/account` and `/en/account`: validate the authenticated user server-side; redirect anonymous visitors to login. Read organization membership through the user's Supabase client with RLS, never the service-role client. New users without membership see a pending-association screen. Client organizations have no staff/CRM access. Dashboard reports remain future work.
- The entire flow fails closed when `SMS_AUTH_ENABLED` or required configuration is absent. A broken rate-limit database prevents sends and verification rather than bypassing limits.

## Separate-project activation runbook
These steps have NOT been performed against a hosted project. Development authorization does not create accounts with external vendors, purchase SMS or deploy production.

1. Select/create the separately approved Supabase project and region. Review and apply `001_initial.sql`, `002_auth_rate_limits.sql`, then `003_inquiry_contacts.sql`. Do not reuse an existing production database automatically. Verify hosted grants and RLS with two organizations before access is enabled.
2. Enable Supabase Phone Auth and self-service signup if desired. A first successful verification can create an Auth user, but never auto-grants organization membership. Membership must be assigned by an authorized, audited staff process; no client-side membership write is permitted. A typed company name is not proof of membership.
3. Configure an SMS provider supported by Supabase, or an authenticated Send SMS hook/bridge. Confirm actual +86 routing, sender/signature, template, account qualifications, pricing and regional restrictions with the selected provider. Do not assume a domestic vendor is a native Supabase integration. Provider credentials belong in Supabase/provider-side secret settings, not this frontend. Use a Simplified Chinese SMS template and never log OTPs.
4. Configure Supabase CAPTCHA protection with Cloudflare Turnstile. The Turnstile secret belongs in Supabase Auth settings; only the widget site key is passed to the browser. Configure authorized site hostnames. Server validation is performed by Supabase when it receives `captchaToken`; do not disable that setting. Test the widget from actual mainland networks before accepting this provider choice. If it cannot be used reliably there, replace the widget and matching Supabase verification together using a supported alternative before launch.
5. In secure application environment settings, configure:

   | Name | Purpose |
   | --- | --- |
   | `SUPABASE_URL` | Separate project HTTPS URL |
   | `SUPABASE_PUBLISHABLE_KEY` | Publishable/legacy anon key; used for user-scoped authentication |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-only limiter RPC and inquiry writes; never sent to the browser |
   | `AUTH_RATE_LIMIT_SECRET` | Random server-only HMAC secret, at least 32 characters; use a proper injected value, not a network-proxy placeholder |
   | `AUTH_OTP_LENGTH` | 6–10 digits, matching actual Supabase OTP length; default 6 |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public widget key matching CAPTCHA settings; rebuild after changing it |
   | `SMS_AUTH_ENABLED` | Keep `false` until prerequisites and final privacy notice are ready; then set `true` |

   Never put credential values in chat or committed files. For local work copy `.env.example` to ignored `.env.local`. The public key/site key may be public; service-role and HMAC secrets must remain server-only. Ensure the runtime network policy allows the exact new Supabase project hostname. Do not guess project domains or replace an unknown allowlist.
6. Review the final account terms/privacy: controller, privacy contact, storage region, SMS/CAPTCHA vendors, purposes, retention and cross-border handling. The existing privacy page is explicitly a development draft; review it before enabling collection.
7. Run real-device acceptance tests listed below, monitor errors and SMS spend, and only then enable the feature in an approved deployment. Keep existing repository identity, Vercel Project, domain, DNS, SSL and email untouched.

## Rate-limit behavior and operations
`002_auth_rate_limits.sql` stores HMAC phone digests and counters; no raw phone numbers or codes. A transaction lock ensures all configured buckets are checked and updated atomically. Browser roles cannot invoke the limiter or read its table. Defaults:
- SMS: 1 request per number per fixed minute, 5 per fixed hour, 100 total per fixed ten minutes.
- Verify: 10 attempts per number per fixed ten minutes, 500 total per fixed ten minutes.
- Fixed windows permit boundary bursts; also enable Supabase/provider-side sending limits and spend caps. These caps are initial operational defaults, not protection against every denial-of-service scenario.
- Rejected/failed provider requests consume an attempt. Rate-limit storage failures return unavailable.
- The frontend's 60-second resend delay supplements backend limits. It cannot authorize another send.
- Global caps intentionally bound distributed SMS cost but may temporarily block legitimate requests during an attack. Monitor before adjusting; do not remove caps to work around an unexplained provider failure.
- Schedule a daily privileged cleanup: `delete from public.auth_rate_limits where updated_at < now() - interval '48 hours';`. No cleanup job has been provisioned. Retention must be part of operational approval. Rotating the HMAC key resets phone bucket identities; coordinate rotation with rate limits and incident response.

## Security and recovery boundaries
Phone verification proves current use of a number, not legal identity or company authority. Recycled numbers/SIM takeover remain risks. Number change, account recovery, company membership administration and staff MFA are not implemented and require a controlled design before sensitive actions are exposed. Sign-out clears local cookies and revokes the refresh session; already-issued access JWTs may remain valid until expiry. Configure short appropriate token lifetimes and additional checks for high-risk operations. Do not claim immediate revocation of every previously copied access token.

## Evidence and required external tests
Local automated tests use test-only provider responses, DOM interaction tests and an embedded PostgreSQL engine (PGlite). They verify error handling, no-send behavior, official SSR cookie persistence/logout, RLS tenant isolation, privileged function grants and executed rate-limit SQL. These are not hosted Supabase or handset-delivery tests.

Before release, test real +86 devices on representative mainland operators/networks: initial and returning login, wrong/expired code, resend throttling, provider outage, CAPTCHA loading, session refresh, HTTPS cookies, logout and cross-tenant authorization. Test actual homepage/login reachability and performance. The cloud environment's HTTP checks cannot establish mainland network reliability. No SMS has been sent by this development task.
