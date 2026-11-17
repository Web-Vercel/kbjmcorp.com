# Agent refund progress — Preview only

Agents see linked customer refund progress on overview, clients, commissions and settlements pages. It is a read-only in-portal update on page load/refresh, not email, push delivery or an unread-notification system.

## Release

After migrations through 046, execute `supabase/migrations/047_agent_refund_progress.sql` in the **Preview Supabase project ziijwwbcpuynkaxsbdvg**. Do not run against Production rywmjguhvnppfxwhherl. This adds only a guarded read RPC; it does not seed accounts, grant business roles, change financial records or send money. The bootstrap includes it for new disposable test databases; do not run the bootstrap on an existing project.

The hosted SQL has not been applied by the development agent: no database execution connector is available. Until applied, the new panel explicitly reports unavailable; other partner pages remain usable. An unavailable or wrong-agent response never becomes an empty queue.

## Scope and privacy

The RPC derives the active verified agent from the authenticated session using the existing credential/session guard. No browser-provided agent ID controls SQL access. An agent sees a refund only when its assignment existed and covered the refund application month (Beijing calendar), or it already had a commission for that customer when the refund was created. A later backdated assignment does not grant access to earlier refunds. Current agent identity is checked again against the portal's verified identity before rendering.

Returned fields are company, application amount, current stage, creation/completion times, record IDs and company-wide refund hold. No bank details, payer/payee references, reason, assessment, staff review note, contract or refund fee agreement is returned. Most recent 100 records only; not a complete-history claim. Future assignees and unrelated agents receive no records. Staff/client/investor/sales and anonymous sessions cannot use this RPC.

## Financial rules retained

Existing `partner_org_refund_hold` and server mutation guards pause affected-company commission settlement while a refund is active. This feature displays that authoritative hold; it does not calculate a separate browser rule. A cancelled/returned request does not imply release when another refund is still active. Approval is distinct from registered payment and verified payment. Paid refunds require agreement-based commission review; a partial unused-balance refund does not automatically cancel all commissions. Existing manual commission adjustments and independent review remain authoritative, and paid commissions are never automatically recovered. No financial action is added here.

## Validation and hosted acceptance

Local tests cover all eight refund stages, unrelated and backdated-agent isolation, denied roles/anonymous/inactive agent access, private-field exclusion, unknown state, approval-versus-payment and other-active-refund copy. Existing financial workflow regressions continue to exercise actual settlement holds.

After Preview SQL and deployment: use the dedicated fictional enterprise and corresponding agent only; open a fictional refund application, verify agent progress/hold, independently process each stage, and confirm no other agent can view it. Do not register actual bank payment as a substitute for a fictional test. Hosted stage acceptance is not yet completed. No new hosted refund or commission record was created during development.
