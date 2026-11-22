# Investor password sign-in — 2026-11-22

Owner explicitly requested removing investor authenticator sign-in and synchronizing specified presentation cleanup to Preview and Production. This supersedes the investor MFA requirement only; investor business access remains read-only and excludes credential/session/authorization administration. Staff and sales MFA are unchanged. Existing verified factors are not deleted; recovery security is unchanged.

Migration 054 changes only `require_live_account`: investor joins client in the AAL1 exception. Active status, expected verified email, credential-change session gate, Auth ban/deletion, incompatible grants and session freshness are preserved. Existing investor-only RPCs and write restrictions remain unchanged. No fixtures, accounts, grants, financial writes, or provider settings are created.

The app checks the database's authoritative `get_live_account_context(p_mfa:true)` for the same investor identity before allowing password-only login. Databases without 054 retain MFA, avoiding a broken rollout between code and SQL. Login, shared guard, security page and stale MFA deadline endpoint use the same policy. This adds a verified context read; failure falls back to MFA rather than granting access.

Deployment: publish the scoped application changes; the owner then runs only 054 in each existing Preview and Production SQL Editor. Do not rerun initialization or 040–053. No remote SQL was executed by this task. Re-login as investor and confirm no authenticator prompt, authorized read views, and unavailable mutation/admin access. Run an employee login check to confirm MFA remains. Preserve actual hosted results separately from local tests.

Local validation: 69 tests passed, one existing optional test skipped, including a real local PostgreSQL-compatible database covering AAL1 investor reads, rejected wallet/admin writes, sales/staff MFA and paused accounts. Production build and bootstrap consistency checks are performed before publication.
