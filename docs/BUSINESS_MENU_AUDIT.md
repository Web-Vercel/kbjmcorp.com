# Business menu audit — 2026-11-15

Scope: authenticated business menus, destinations, successful page headings and existing role capabilities. Public marketing navigation is unchanged. This is a source and automated regression audit; hosted account acceptance remains separate.

## Role alignment

- Administrator: all 19 operations destinations, business account authorization and legacy project collaboration authorization. Administrative labels describe management scope.
- Finance preparer: the existing 15 finance destinations; preparation and receipt registration labels, quote/source viewing, financial consultation only. No staff authorization, advertising sync, private procurement or manual account binding entry.
- Finance reviewer: the same authorized finance destinations with independent review labels. Preparation-only actions remain governed by existing server/database checks.
- Source/support staff: only destinations allowed by their verified source/support capabilities. Finance consultation does not grant general support access.
- Client: overview, statements/downloads, monthly funds statements, advertising/cost analysis, service/billing questions, refund requests and account security. “Monthly funds statements” describes the ended-month report; it is not a current-balance ledger.
- External agent: overview, own clients, own commissions, own settlements, cooperation files and account security; no internal finance or client-wallet navigation.
- Investor/sales: existing access workspace and authorized analysis/security destinations. Legacy account URLs now retain their role's access navigation instead of advertising client finance menus. Sales analysis is labelled client follow-up analysis.
- Customer-service operators: existing CRM/application/project/account work remains available; administrator-only authorization menus and unauthorized collection shortcuts are hidden.

## Changes

Operations labels now use a shared canonical map across workspace navigation and successful page headings. Role-specific names intentionally differ where responsibilities differ: management, preparation, registration, viewing and review. Destinations and financial authority are unchanged.

Legacy “Client access” is renamed “Project collaboration access” in the admin sidebar, breadcrumbs and page, distinguishing legacy project membership from business account authorization.

Client service headings match the service/billing menu. Client monthly funds and sales analysis labels match the actual report purpose. Investor/sales legacy URL navigation no longer suggests unrelated client actions.

## Verification boundary

Regression tests cover operations role visibility, shared labels, external role navigation and administrative sidebar filtering. Existing route, API and database authorization remain authoritative; hiding a menu is not an authorization mechanism. No SQL, account grants, balances, bills, payments, email or popup behavior changes are included.
