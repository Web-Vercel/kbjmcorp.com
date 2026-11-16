# Client A/B isolation acceptance

## Current state

Local automated isolation checks pass. The selected hosted client A/B read-isolation checks below have now been confirmed by the owner; untested reverse-direction fixtures are listed separately.

- Client A: existing `+client-demo` account, assigned to 财务流程验收企业（虚构）. Existing balance CNY 703.23 and statement CNY 296.78 must remain unchanged.
- Client B: the owner screenshot confirmed `kennylu.ai.canada+client-demoB@gmail.com` was created and enabled for the existing uniquely named 测试企业B. A Preview-only setup panel is provided on the administrator account-access page. Its presence is not evidence that an account has been created.

## Client B setup panel

Only rendered to the already authenticated administrator in Vercel Preview. Requires exactly one existing company named 测试企业B and a current administrator Gmail address, from which a `+client-demoB` alias is derived. Existing client accounts linked to B are shown instead of offering creation. A matching alias already assigned elsewhere suppresses setup. No arbitrary third-party recipient is generated.

The button generates a cryptographically random initial password in the administrator's browser. It reuses the existing administrator-only account creation API, which creates Auth and a paused client grant, then activates only the returned client/company/user/revision through the existing access API. A mismatched response cannot trigger activation. No credential is logged, emailed or stored in browser storage. The password remains masked with the existing show/hide control and must be saved before refreshing. A failed or uncertain result locks further creation until account/Auth state is checked. Created-but-paused accounts can be resumed in the existing list.

No company is duplicated; no customer A grant, wallet, statement, payment, receipt, advertising account or bill is changed. Initial company B financial and report screens may correctly be empty. No SQL migration is needed.

## Hosted checks confirmed by the owner

- A and B each see their own statement/account scope after the verified identity banner was added.
- B opens A's known October statement URL: no A statement amount/detail is rendered.
- B opens A's known service ticket: 404; A opens the identical URL: the original four messages appear.
- B requests A's service CSV endpoint: `not_found`, with no downloaded conversation.
- B monthly funds screenshot: only 测试企业B, October 2026 CNY 0.00 and zero posted entries.
- A monthly funds screenshot: only 财务流程验收企业（虚构）. The owner supplied A wallet `27f4386f-f39c-4a37-9b34-35e6ef3a3bea`, month 2026-10; B opens that exact funds URL: 404.
- B analytics screenshot: B identity/scope, zero published charges and posted balance, no A financial data.
- B analytics request with a deliberate foreign test company parameter: explicit no-permission message. The corresponding statements-export request returns `forbidden` without a file.

This completes the selected basic hosted read-isolation matrix. It does not claim a full security audit or coverage of every historical deployment. A→B direct ticket/export checks require a B ticket fixture and have not been performed; no B financial data is created merely to manufacture test cases. Existing customer A own-service/CSV positive controls were previously confirmed and are not repeated unnecessarily.

Use separate browser profiles or sign out before changing client identities. Administrator access is not evidence of a client data leak.

## Reported session ambiguity

The owner reported both client views showing the 测试企业B · CNY wallet option. The screenshots show an empty published-statement list, not evidence of a shared published bill. Both screenshots are in Chrome Incognito; tabs and windows in the same Incognito session can share the last signed-in account. This is a hypothesis to verify, not a passed isolation result or a confirmed permission leak.

Verified identity banners and cross-tab session invalidation are added; see [Portal identity and session views](PORTAL_IDENTITY.md). Repeat hosted acceptance with A in a normal browser profile and B in a separate Incognito profile, checking the visible email and company before opening direct links. Multiple Incognito windows alone do not establish isolated browser profiles.

## Hosted observations after the identity banner

The owner confirmed client A and B each see their own statement/account display. A subsequent screenshot shows client B's verified banner (client-demoB / 测试企业B), the known client A statement ID in the URL and no client A bill/amount/detail rendered. This confirms that specific B→A statement read did not disclose A's bill; it does not prove all service/export endpoints or the reverse direction.

A direct inaccessible/nonexistent statement link now shows one generic explanation and a link to the current user's authorized statements. It does not change the signed-in account, disclose whether the requested foreign bill exists or infer access denial from an upstream query error. A returned statement ID inconsistent with the requested ID is treated as unavailable, without exports.

## Next workflow acceptance

Continue with intercompany CAD receipt verification/allocation for 财务流程验收企业（虚构）, settlement month 2026-10. First inspect the scope and existing receipts to avoid duplicate fictional registration. Known pinned procurement amount is CAD 45.30; actual verified allocations must be read from the workbench, not inferred from a client debit. Only dedicated fictional acceptance records may be used. Refund acceptance remains last; agent settlement remains subject to its waiting period.
