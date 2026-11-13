# Email password recovery

Implemented on Preview only. No hosted users, passwords, mail templates or Production settings are changed by this commit.

## Required per-project configuration

Supabase Authentication → Emails → Reset password: replace the recovery link target with the exact deployment hostname and path, for example:

```html
<a href="https://PREVIEW-HOST/zh/auth/recovery?token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a>
```

Replace PREVIEW-HOST with the stable Preview deployment domain for the Preview Supabase project. Never point Preview recovery mail at Production. When separately approved and deployed to Production, its own project template should use `https://kbjmcorp.com/zh/auth/recovery?token_hash={{ .TokenHash }}&amp;type=recovery`. English may use `/en/auth/recovery`. Use TokenHash, not Token or ConfirmationURL; the implementation deliberately does not accept implicit access-token fragments or arbitrary PKCE codes. Keep Site URL at the website root; do not change it to the reset page. If configuring redirect allowlists, allow only the exact corresponding recovery page. No wildcard domains.

The template applies to both Dashboard Send password recovery and the website Forgot password action. Request a NEW email after configuring; old mail still targets the old homepage. Keep CAPTCHA enabled with Turnstile and its matching secret. The website request uses existing auth configuration and persistent rate limiting. Production configuration is not inferred from local environment files.

## Acceptance

On Preview, use a dedicated test account: Forgot password → CAPTCHA → email → new password twice (12+ characters) and existing authenticator code if enrolled → return to login → new password → existing MFA. Check expired/reused links fail; old password fails; existing duties are unchanged; no recovery session grants workspace access. Repeat both locales. Do not share the email link, token or password in chat/screenshots. Actual email delivery requires configured Supabase SMTP; a generic request acknowledgement deliberately does not prove delivery.

Recovery verification and password update use an isolated Supabase client. A successful email verification creates a separate AES-GCM encrypted HttpOnly, Secure, SameSite=Strict cookie restricted to `/api/auth/recovery`; it never creates a workspace Auth cookie. The encrypted grant is bound to the project and email link and expires after ten minutes without extension. Missing/invalid MFA and rejected passwords can be corrected on the same page without consuming another email link. Every enrolled-account retry still requires valid TOTP. MFA refresh-token rotation is retained before retry. Success globally signs out recovery sessions and clears the grant. Existing roles and factors are unchanged. Refreshing or closing the page loses the in-memory link hash; use a new email in that case.

The UI distinguishes expired links, missing/invalid MFA, password reuse/policy rejection, throttling and upstream configuration failure. Fixed password update error codes may be logged, never email, passwords, session credentials, raw upstream messages or link hashes. Real hosted end-to-end success must still be checked by the account owner; automated SDK tests use fictional HTTP fixtures and do not send email or update hosted users.
