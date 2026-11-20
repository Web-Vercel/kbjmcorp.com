# Preview: inactivity sign-out and guide assistant

Owner request November 20, 2026 (Vancouver). Confirmed policy: 15 minutes without user activity. Preview backend scope only; this is excluded from synchronized public marketing releases and must not be copied into Production.

## Inactivity

Authenticated administrator, operations, client/account, sales, investor and agent workspace shells use the same timer. Login screens and unauthenticated pages do not. A native modal warns at 14 minutes and offers Continue working; at 15 minutes the workspace is locked while existing local sign-out runs. Unsubmitted content is not automatically saved. Success redirects to the appropriate existing login with an inactivity message. Identity/sign-out errors keep the modal locked and offer retry; they are never reported as a successful sign-out.

Real pointer, keyboard, wheel and touch events count as activity. Passive polling, background fetches and merely focusing a tab do not. Last activity is stored per user without credentials and shared through storage events across same-browser tabs. Reads occur on each tick and on focus/visibility/pageshow, including wake from suspended tabs. Navigation retains the deadline. Successful sign-in/out clears previous inactivity timestamps. Before sign-out, current server identity is checked so a stale tab cannot sign out a newly signed-in account.

This is browser inactivity handling using the existing local sign-out endpoint, not a new database/session lifetime policy. Suspended browsers enforce it when resumed. Storage-disabled browsers use per-mounted-tab memory, so cross-tab and navigation persistence cannot be guaranteed there. Existing server authorization, MFA and credential-session gates remain mandatory. No global sign-out of other devices and no SQL changes.

## Guide assistant

Authenticated workspaces have a bottom-right 使用指南助手 / Guide assistant entry. The server verifies existing staff/MFA or external business-role context; a supplied role or company is never trusted. Only role-appropriate curated usage guides are searched. Sources link to existing pages and remain subject to their normal authorization. The assistant cannot query, edit or execute business records or payments. Text is rendered as plain React text, never HTML. No conversation history is persisted. Questions are limited to 500 characters; obvious credential input is rejected. The UI asks users not to include credentials, client details or financial records.

Guidance is curated from existing workflow pages and docs/OPERATIONS_ROLE_NAVIGATION.md: versions/approvals, client funds/statements, refund workflow, month close, role separation and account recovery. Unknown questions get an explicit no-matching-guide answer.

Without model configuration the assistant is fully usable as **guide search**, explicitly labeled as such. Optional real AI needs server-only `WORKSPACE_HELP_OPENAI_API_KEY` and optionally `WORKSPACE_HELP_MODEL` (default `gpt-4.1-mini`). Do not prefix secrets with NEXT_PUBLIC. No secret has been added or configured by this change. If configured, only the question and matched curated guide text are sent to OpenAI Responses API, with `store:false`; user identity and business data are never loaded for the model. AI output is guidance, not an action confirmation. A failed model request falls back to the guide with an explicit unavailable message. API keys never go to the browser. Network access to api.openai.com must be allowed before enabling live AI. No external call occurs without a configured key or without a matching guide.

Per-instance memory limits are six questions/minute/user, with a bounded map. This is suitable for Preview usage, not a distributed cost-control guarantee; a shared limiter is needed before a wider AI rollout. Current environment has no configured AI key, so real model answers have not been hosted-tested.

Validation: unit/component tests cover warnings, continuation, other-tab activity, old deadlines, identity changes, locked failures, role isolation, MFA, anonymous requests, origins, rate limiting, no-model behavior, model errors, and minimal model payloads. Model tests use mocks; no real model or real payments are invoked.

Final verification: optimized Next.js build passed; 42 focused authentication, inactivity, session synchronization, guide API and assistant component tests passed. API/model tests are mocked; no hosted 15-minute wait or real model call is claimed. The Production release remains at 7159369.
