# Unified business workspace

The owner approved one system with two role-specific entry portals on 2026-11-16 (UTC).

## Entry portals

- `/[locale]/admin/login`: employee sign-in for joint Canada–China work. Existing staff authentication and MFA remain required; roles determine access.
- `/[locale]/access/login`: authorized external clients, agents, investors and other business accounts. Existing external login, role destinations and MFA requirements are unchanged.
- The public website's existing `/[locale]/login` link forwards ordinary sign-in to the external portal. Explicit legacy statement/service/funds return contexts and the separate application verification flow remain compatible; unsafe return URLs do not bypass the portal redirect. Public header, branding and homepage source are unchanged.

## One internal navigation

Both `/admin/*` and `/operations/*` use the same shell, grouped navigation and breadcrumb model. Existing URLs remain valid; there is no separate Three-party operations center or return-center switch. The groups are:

1. Clients and business: inquiries, CRM, applications, projects and authorized service requests.
2. Advertising operations: accounts, synchronization, manual account/source records and coverage checks.
3. Finance and settlement: month close, quotes, bills, receipts, fund records, refunds, procurement and intercompany receipts.
4. Agents and commissions: role-specific assignment/commission/settlement work.
5. Accounts and permissions: administrator-only business accounts and collaboration grants, and authorized staff responsibilities.

The collection route appears once, under Finance and settlement. Current groups expand and the selected destination is marked. Mobile uses an inline expandable work menu which closes after route changes. Language switching preserves the current route. Existing role-specific home screens retain their data and reminders: management/CRM-authorized staff use `/admin`; finance/source-only staff use `/operations`.

## Authorization

Navigation is derived from verified staff identity, the existing `get_ops_context` and `has_staff_access`. The management layout already requires staff access; the operations layout separately verifies it to determine CRM/management visibility. A failed operations-context query cannot grant operations items. A failed management-access query hides management items. Finance-only preparers/reviewers retain their 15 existing finance destinations and role-specific labels, without acquiring staff authorization, advertising sync, private procurement or binding privileges. Customer-service staff retain CRM work; administrator-only grants remain hidden. Server and database guards remain authoritative.

No financial state, account grant, bill, approval, email, popup, payment integration or SQL migration changes are included. This integration is Preview only.

## Validation

Automated coverage checks all 19 operations destinations occur once in the grouped menu, preparer/reviewer isolation, admin versus CRM visibility, shared breadcrumbs/shell, mobile menu behavior, portal labels and legacy return compatibility. Local fictional HTML is used for desktop/mobile layout checks; it is not hosted account acceptance. Client A/B acceptance remains pending identification or creation of a second independent client account.
