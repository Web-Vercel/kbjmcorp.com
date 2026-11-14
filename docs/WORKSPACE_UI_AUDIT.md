# Workspace presentation audit — 2026-11-14

Scope: authenticated admin, operations, account and access page routes. Preview implementation; no Production publication. Public marketing pages, APIs, SQL, calculations and financial workflow transitions are unchanged.

## Purpose separation

- Operations overview now contains task links only. No report registration, staff assignment, financial details or service reply forms are rendered or fetched there.
- Separate destinations: manual account links, manual source reports, manual reconciliation drafts, posted fund summary, service requests and staff responsibilities. Each destination validates the existing role requirement before reading its records.
- Company records show one selected subject: profile, contacts, permissions, contracts or finance. Non-administrators cannot select restricted subjects. Navigation uses URLs and supports browser back/forward. Existing internal links and old hash links lead to the corresponding subject.
- Related actions remain together: a report and its review; a receipt and its independent review; a settlement and publication; an account and its permissions. This preserves task context rather than splitting one workflow into disconnected forms.

## Default collapsed

New project, manual company creation, account association, verified customer association, new login account, existing-account permission setup, new settlement draft, staff responsibility adjustment, manual report registration, optional file fingerprint, new contact and wallet creation.

Existing workflow guidance, source identifiers, provenance and optional historical details retain their disclosures. Existing collection configuration is already collapsed. Day-to-day filters, active review controls, unavailable-data errors, fictional/nonpayable labels and financial consequences remain visible at the point of use.

## Other routes reviewed

Admin overview, inquiries/list/detail, project detail, applications, CRM contracts; operations data sync, source handoff, coverage checks, pricing, collections, client funds, procurement, intercompany receipts, billing questions, month-close and contract details; customer application/company/projects/reports/contracts/statements/funds/service; business login/security/overview/investor/analytics.

These are already organized around a task or record. Their existing concise presentation is retained unless listed above. Authentication and MFA forms remain immediately visible. Read-only overviews may summarize multiple subjects and provide links; they should not embed unrelated working forms.

## Verification

TypeScript checks, page/UI/navigation regression suite, dedicated overview/no-record-fetch and direct-role-access checks, and company-record subject isolation checks. Hosted Preview visual inspection remains necessary after Vercel finishes deploying; local checks do not prove the deployed version.
