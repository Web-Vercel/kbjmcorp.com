# Monthly calculation and draft preparation — Preview

## Delivered stage

The month-close account card offers administrators “自动计算并生成草稿” when a complete, ready, actively bound monthly source exists and no settlement draft or publication exists. The administrator confirms the applicable percentage-fee/customer-borne-transfer agreement reference. The server obtains the exact source CAD cents from the validated month-close RPC, resolves global/customer monthly pricing (including explicit zero), fetches the closed month's Bank of Canada reference, saves the immutable quote, then calls the existing settlement preparation RPC. It never approves, publishes, posts a ledger debit or sends a payment.

Source ID, binding, company and month must match. Pricing reads fail closed. Saved evidence includes full FX reference metadata, fee revision IDs and source/agreement references. Existing money calculations and database permissions remain authoritative; no schema change is required. The resulting draft is visible in the existing preparation/review workspace.

## Recovery

The browser pins a request UUID and agreement across uncertain attempts and checks the full receipt scope. An existing quote for that user's request is reused without refetching rates/FX. A changed source, company/month/binding/agreement conflicts. If quote save succeeded but preparation failed, retry resumes preparation. Existing drafts block new requests, and publications block this endpoint. Existing independent review and database publication uniqueness protections remain in force. Concurrent requests with the same ID may produce an explicit conflict if observations changed before the first quote became visible; inspect records and retry the original request, never manufacture a replacement.

## Not enabled yet

This milestone requires an already collected, verified and handed-off monthly source and an administrator session. It is not a scheduled worker. Source polling, multiple account credentials, durable job leases/backoff, stored automation agreement configuration and non-interactive least-privilege authorization are separate remaining work. Do not run privileged MFA-protected RPCs with a service-role shortcut or claim unattended month-end billing is active. Official FX live reachability and authenticated hosted acceptance remain pending. No Production or financial records were changed during development.

Local validation: 38 tests covering calculation, zero overrides, provenance, API authorization/source scope, partial-write recovery, UI retry receipts and existing quote/month-close behavior; TypeScript and Next.js build.
