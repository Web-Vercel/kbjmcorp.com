# Email password recovery

The owner authorized this password recovery fix for Production on 2026-11-13. Source code matches the tested Preview implementation. No hosted users, passwords or mail templates are changed by the code deployment. Production activation requires the email template below.

## Required per-project configuration

Supabase Authentication → Emails → Reset password: replace the recovery link target with the exact deployment hostname and path, for example:

```html
<a href="https://PREVIEW-HOST/zh/auth/recovery?token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a>
```

Replace PREVIEW-HOST with the stable Preview deployment domain for the Preview Supabase project. Never point Preview recovery mail at Production. The Production project template must use `https://kbjmcorp.com/zh/auth/recovery?token_hash={{ .TokenHash }}&amp;type=recovery`. English may use `/en/auth/recovery`. Use TokenHash, not Token or ConfirmationURL; the implementation deliberately does not accept implicit access-token fragments or arbitrary PKCE codes. Keep Site URL at the website root; do not change it to the reset page. If configuring redirect allowlists, allow only the exact corresponding recovery page. No wildcard domains.

The template applies to both Dashboard Send password recovery and the website Forgot password action. Request a NEW email after configuring; old mail still targets the old homepage. Keep CAPTCHA enabled with Turnstile and its matching secret. The website request uses existing auth configuration and persistent rate limiting. Production configuration is not inferred from local environment files.

## Acceptance

On Preview, use a dedicated test account: Forgot password → CAPTCHA → email → new password twice (12+ characters) and existing authenticator code if enrolled → return to login → new password → existing MFA. Check expired/reused links fail; old password fails; existing duties are unchanged; no recovery session grants workspace access. Repeat both locales. Do not share the email link, token or password in chat/screenshots. Actual email delivery requires configured Supabase SMTP; a generic request acknowledgement deliberately does not prove delivery.

Recovery verification and password update happen in one same-origin POST using an isolated, nonpersistent Supabase client. Only a verified recovery hash authorizes the password update. No Auth cookie is installed. Temporary recovery sessions are signed out globally after update attempts (also invalidating other refresh sessions). MFA factors and staff roles are never changed. Enrolled TOTP accounts must supply their existing authenticator code, verified before password update. Unsupported factor types and failed verification fail closed; contact the administrator for the supported account recovery process rather than removing factors automatically. Link hashes are cleared from the address bar on load; the page sends no referrer, is no-store/noindex. Hosting access logs can still contain the initial URL; restrict log access. Demo-cookie API restrictions remain enforced.

## Production template

In 智点未来-production → Authentication → Emails → Reset password, retain the email wording and replace the reset anchor with:

```html
<a href="https://kbjmcorp.com/zh/auth/recovery?token_hash={{ .TokenHash }}&amp;type=recovery">重置密码 / Reset password</a>
```

Save, then request a fresh recovery email. Previous emails still target the homepage. Do not edit Preview's template to the Production hostname. No new environment variables or database migrations are needed.
