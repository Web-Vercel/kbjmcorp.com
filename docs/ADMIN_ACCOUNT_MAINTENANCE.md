# Administrator account maintenance

Preview-only implementation requested by the owner on 2026-11-15 (Vancouver). Apply incremental `046_admin_account_credentials.sql` to the Preview project after existing migrations through 045. Suggested SQL Editor name: **41 管理员账号密码与邮箱维护（脚本046）**. Do not run the new-project bootstrap in an existing project. This implementation does not itself execute hosted account changes or apply SQL.

## User flow

Business management center → Accounts and permissions → Business account access → Account maintenance · Password and email.

The administrator selects a managed account and checks its current email, role/duties, company/scope and active state. Password resets require a new password twice (16–128 characters), reason and confirmation. Email changes require a valid new email, independently verified mailbox ownership/account-holder authorization, reason and confirmation. The operation uses Supabase Auth Admin SDK directly and does not rely on recovery-email links or Vercel sharing cookies in another browser. Existing MFA factors remain enrolled. Old passwords are never read or returned.

Targets include clients, external agents, investors, sales, staff operators (including preparers/reviewers) and other administrators. The current administrator's own account is intentionally excluded from this maintenance flow: a separately authenticated administrator can maintain it, or the owner can use self-service recovery. Self-service recovery remains available and its email/Preview configuration still needs hosted acceptance.

## Consistency and audit

`list_managed_accounts` exposes only managed staff/business/agent metadata to an active administrator at AAL2, not an arbitrary Auth user directory or credentials. The mutation endpoint is same-origin only, rechecks administrator MFA through the existing guard, applies persistent throttling and refuses self/unknown/stale targets. No browser service key is used.

Before Auth is changed, a database operation record and per-user maintenance lock are committed. Scoped account/agent revisions and sign-in cutoffs advance. Auth updates receive only the selected user's password OR verified email fields. Passwords are never stored in application tables, audit logs, URLs or responses. Success is finalized by a service-only RPC. For email changes it verifies the actual confirmed Auth email before synchronizing the live-account/agent email pins. Role, organization, active/paused state, assigned responsibilities, authenticators and financial history are preserved.

Staff and operating authorization functions, the staff identity RLS policy and scoped client/agent identity checks reject maintenance-locked or pre-cutoff sessions. Password failure also requires fresh sign-in; it does not reactivate a paused account. Supabase JWTs are not magically deleted: application/database authorization enforces the session cutoff, and a fresh Auth sign-in is required. Existing accounts without maintenance history keep their previous session rules.

An uncertain Auth response or finalization failure is never labelled successful or automatically retried. The target remains locked. The administrator refreshes the list and uses reconciliation after at least 60 seconds. This service-only completion checks the actual Auth email against the recorded old/new email; unrelated email drift remains locked. Password reconciliation releases maintenance without claiming the chosen password succeeded: verify sign-in and perform a fresh password reset if needed. Administrator-only maintenance records retain initiating and finishing administrators, target, action, reason, result and email change metadata. The general business audit stream contains only operation identifiers/action/status, keeping mailbox values and reasons out of broader staff audit views. No MFA-factor deletion or role reassignment is performed.

## Validation

Database tests execute the full bootstrap in local PGlite: AAL2 administrator access, target coverage including other admins and agents, self/unknown rejection, pending lock and replay conflict, service-only finalization, old-session rejection and fresh-session access, email pin synchronization, uncertain-result reconciliation, preserved roles/scope and unchanged fictional posted funds. API tests cover origin/role/MFA checks, prerequisites, Auth update attributes, password-policy errors and unconfirmed outcomes. UI tests cover target scope, password confirmation, clearing entered passwords, policy retries and reconciliation affordances. Hosted account-password/email acceptance remains pending applying the migration and owner action; no passwords or recovery links should be shared in chat.
