# Verified business applications

This extends the approved website using independent routes; see [APPROVED_HOMEPAGE_BASELINE.md](APPROVED_HOMEPAGE_BASELINE.md). Homepage copy, layout, hero, branding, shared CSS, navigation and imagery are unchanged.

## Entry points

- Existing homepage **客户登录** → login page **首次合作？了解企业申请流程** → `/{locale}/apply`.
- `/{locale}/apply` explains the process and links to `/{locale}/login?flow=application`.
- Only the exact `flow=application` value changes successful sign-in to `/{locale}/account/application`. No arbitrary return URL is accepted; existing login defaults to the client center.
- Authenticated client center → **企业合作申请与审核进度**.
- China customer-service / owner staff navigation → **企业申请审核**, `/{locale}/admin/applications`.
- Public fictional walkthrough: `/{locale}/application-preview`, linked from the application overview and staff demo navigation. Page-memory only, no database/SMS/business writes; refresh clears it. Do not enter real information into the demo.

## State and permissions

`submitted → needs_information → submitted → approved/rejected`, with explicit revision checks for each transition. Customers can withdraw open applications. Reviewed, rejected and withdrawn submissions cannot be silently edited or reopened. At most one open application per verified user; three new applications per 24 hours and at most 40 revisions before further resubmission is stopped. New applications require a uniquely verified mainland phone read from Auth's stored user record, not caller metadata. Staff cannot submit as customers or approve their own former customer application.

Customers read their own application and customer-visible feedback only. Staff review requires active owner or China customer-service responsibility with MFA. Canada operations and China finance have no application queue access. Browser roles cannot directly mutate status, identity, application history or company grants. History stores prior submission snapshots in a private table; ordinary audit metadata does not copy contact details or requirement text.

Approval creates a **new prospect CRM company and business contact**, transactionally. It never links an applicant to an existing company by name, phone or email, and never grants membership, financial permission, a wallet, a contract, or an advertising account. Staff must investigate duplicates, verify the company's authority, arrange contracts, and approve an explicit invitation using the existing CRM workflow. Approvals are not a platform partnership claim or commitment to run an ad in an unsupported market.

## Enablement and limits

Apply migrations 001–013 to the selected isolated database; none were applied to a hosted project in this task. Configure the existing Auth/SMS flow and two staff/client test accounts. Review privacy processing, access, data region, retention/deletion procedures and real business information before collecting real details. Then set `CLIENT_APPLICATIONS_ENABLED=true` in that test deployment. Default is false: public overview remains accessible, writes return 503, and protected forms are unavailable. This app flag is not a substitute for database authorization; the RPCs themselves enforce identity and role checks, and a deployed database migration exposes those functions to authenticated sessions.

There is no anonymous application submission and no service-role key in the browser. The existing homepage inquiry form and inquiry conversion remain separate and unchanged. No document uploads, ID-card collection, business-license verification, emails, SMS notifications, payment, platform provisioning or automatic membership are performed by this extension.

Customer list shows the latest 20 own records; staff queue shows up to 100 matching records. Add pagination and approved retention/deletion tooling before larger-scale intake. Withdrawal is not deletion. Existing private storage, bank payment, monthly-report publishing and settlement prerequisites remain separate.

Checks: `npm test`, `npm run typecheck`, `npm run build`; with a built unconfigured local server, `SMOKE_BASE_URL=http://127.0.0.1:3027 npm run test:applications` and the existing homepage browser regression suite.

Validation for this iteration: 250 automated tests passed, TypeScript and production build passed; Chromium application entry/review/privacy checks passed in both languages and four widths, the existing homepage suite passed 9 scenarios across six widths, and staff routes passed 25 checks. Protected homepage source, content, shared CSS and public assets compare byte-for-byte unchanged against development baseline `ab8dbe2`. Local tests do not establish hosted database, actual SMS delivery or Vercel deployment readiness.
