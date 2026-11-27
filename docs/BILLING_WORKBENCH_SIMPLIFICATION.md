# Unified billing workbench — Preview

Default `/operations/month-close` now redirects to `/operations/settlements`, preserving company and optional historical month. The main page shows account summaries/current tasks, then history. The history month filter is below the cross-month summary; selecting November does not hide an October task. Actual account settings decide automatic/manual presentation.

Existing detailed month-close workflow remains accessible at `/operations/month-close?company=...&month=...&view=details`. Legacy list-filter bookmarks retain their detailed route. Full flow, funding, client acknowledgement, question records, export/handoff and intercompany links are secondary, not repeated default dashboard sections. Permission and payment/test-mode behavior remain intact.

History details/review actions are closed by default. Existing draft task links target the real draft anchor; OperationsSection opens on the anchor so independent review and publication remain reachable. Unknown start months, errors, gaps and independent reviewer requirements stay visible in account cards. No automatic publication or financial actions are introduced.

No new SQL, account setting changes or Production release in this change. Existing 058 RPC required. Validation covers unified routing, explicit details, earlier pending draft, month filters, role-scoped review and publication and detailed-route regressions. Hosted visual review remains the owner's next step after Vercel Ready.
