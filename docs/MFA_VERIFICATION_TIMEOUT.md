# Pending authenticator verification timeout — 2026-11-20

Owner approved a five-minute pending verification window and ten minutes for initial authenticator enrollment. This applies to employee and external roles which require MFA; clients/agents retain their existing password-only policy. Existing authenticated workspace inactivity remains 15 minutes with its 14-minute warning.

The server derives the deadline from Supabase's authenticated `user.last_sign_in_at`, not page load, input activity, query parameters or browser storage. Page refresh and invalid codes cannot renew the window. Both MFA APIs reject requests beyond that deadline, even with JavaScript disabled. A successful provider verification finishing beyond the deadline attempts local sign-out and reports failure if cleanup cannot be confirmed. Missing provider timestamps fail closed.

The page displays a countdown using the server clock offset. On expiry it locks verification, checks the current server identity and ends that local sign-in before returning to the matching login page with an explanatory message. The endpoint will not sign out a different identity or an already verified AAL2 session (including verification completed in another tab). Network or provider failures leave the page locked with explicit retry; browser sleep/offline can delay navigation, and waking/focusing the page rechecks elapsed time. This is not revocation of all devices or an Auth-provider session lifetime setting.

No SQL, role grants, credentials, environment variables, existing verified factors, financial records or public frontend changes. New MFA UI requests send expectedUserId to reject stale-tab actions. Existing factor ownership/rate limits and verified-factor replacement restrictions remain intact.

Local validation: 65 focused auth/navigation/UI tests, TypeScript check and production build. Hosted verification remains a separate owner check after Vercel Ready: sign in, leave MFA blank for five minutes, confirm timeout and login return; first enrollment gets ten minutes. Do not share QR codes or dynamic codes in screenshots.
