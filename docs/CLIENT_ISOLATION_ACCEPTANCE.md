# Client A/B isolation acceptance

## Current state

Local automated isolation checks pass, but hosted two-account acceptance is not complete.

- Client A: existing `+client-demo` account, assigned to 财务流程验收企业（虚构）. Existing balance CNY 703.23 and statement CNY 296.78 must remain unchanged.
- Client B: the owner screenshot confirmed `kennylu.ai.canada+client-demoB@gmail.com` was created and enabled for the existing uniquely named 测试企业B. A Preview-only setup panel is provided on the administrator account-access page. Its presence is not evidence that an account has been created.

## Client B setup panel

Only rendered to the already authenticated administrator in Vercel Preview. Requires exactly one existing company named 测试企业B and a current administrator Gmail address, from which a `+client-demoB` alias is derived. Existing client accounts linked to B are shown instead of offering creation. A matching alias already assigned elsewhere suppresses setup. No arbitrary third-party recipient is generated.

The button generates a cryptographically random initial password in the administrator's browser. It reuses the existing administrator-only account creation API, which creates Auth and a paused client grant, then activates only the returned client/company/user/revision through the existing access API. A mismatched response cannot trigger activation. No credential is logged, emailed or stored in browser storage. The password remains masked with the existing show/hide control and must be saved before refreshing. A failed or uncertain result locks further creation until account/Auth state is checked. Created-but-paused accounts can be resumed in the existing list.

No company is duplicated; no customer A grant, wallet, statement, payment, receipt, advertising account or bill is changed. Initial company B financial and report screens may correctly be empty. No SQL migration is needed.

## Hosted checks pending

1. Verify B is active and linked only to B, using the account list and B's sign-in.
2. B overview and selectors must not list A, its CNY 703.23 balance or CNY 296.78 statement.
3. Open A's known statement and service-ticket links as B; neither may expose A's data, document or export. Distinguish authorization denial from server errors.
4. Create a clearly named fictional service request for B without any financial adjustment, then verify A cannot list it or open its direct link/export.
5. Verify each client still reads its own authorized data and downloads. Record observed outcomes; do not mark manual checks passed from code inspection alone.

Use separate browser profiles or sign out before changing client identities. Administrator access is not evidence of a client data leak.

## Reported session ambiguity

The owner reported both client views showing the 测试企业B · CNY wallet option. The screenshots show an empty published-statement list, not evidence of a shared published bill. Both screenshots are in Chrome Incognito; tabs and windows in the same Incognito session can share the last signed-in account. This is a hypothesis to verify, not a passed isolation result or a confirmed permission leak.

Verified identity banners and cross-tab session invalidation are added; see [Portal identity and session views](PORTAL_IDENTITY.md). Repeat hosted acceptance with A in a normal browser profile and B in a separate Incognito profile, checking the visible email and company before opening direct links. Multiple Incognito windows alone do not establish isolated browser profiles.

## Hosted observations after the identity banner

The owner confirmed client A and B each see their own statement/account display. A subsequent screenshot shows client B's verified banner (client-demoB / 测试企业B), the known client A statement ID in the URL and no client A bill/amount/detail rendered. This confirms that specific B→A statement read did not disclose A's bill; it does not prove all service/export endpoints or the reverse direction.

A direct inaccessible/nonexistent statement link now shows one generic explanation and a link to the current user's authorized statements. It does not change the signed-in account, disclose whether the requested foreign bill exists or infer access denial from an upstream query error. A returned statement ID inconsistent with the requested ID is treated as unavailable, without exports.
