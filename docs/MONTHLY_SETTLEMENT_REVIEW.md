# Source-linked monthly preparation and independent review

Run migration `024_monthly_settlement_review.sql` after migrations 018–023 in the existing Preview project. Suggested SQL Editor label: **20 月度结算来源关联与独立复核**. This stage creates immutable internal preparation/review records, not published client statements or wallet charges.

## Workflow

1. Administrator reads a closed natural month for the actual advertiser and explicitly hands the source to its correct client company.
2. In pricing, administrator saves an appropriate quote version for the same company and month with the monthly source spend and verified fee terms. An internal quote alone does not prove customer acceptance. Keep actual fee-agreement evidence outside the platform; record its reference.
3. Administrator or scoped finance preparer opens `/zh/operations/settlements`, selects the company, complete source and matching-month quote, and confirms the agreement reference and preparation note.
4. Another administrator or scoped finance reviewer reviews the immutable preparation. The preparer cannot review their own record, including an administrator. Approval/rejection is final for this draft; exact retries are idempotent. Correct a rejected preparation by saving a new quote revision and preparing another draft, preserving provenance.
5. Approved means **reviewed, not published/debited**. Statement publication and atomic ledger posting are a separate stage still to be implemented.

## Checks and limits

Database checks enforce active advertiser-company binding, explicit handoff, CAD source currency, same company and natural month, a month closed in the advertiser timezone, no pending checks or missing dates, verified end semantics, one unique daily record per calendar day, and exact daily/period spend agreement. Missing rows are never treated as zero. The full month's micro-unit spend is rounded once half-up to CAD cents and must equal the quote's original advertising cost. Archived quotes cannot be prepared or approved. Binding pause blocks new preparation/review and finance projection until restored.

Quote selection is one account/month source per quote version. A quote cannot be attached to another source afterward. Alternative quote versions remain separate internal drafts, never additive charges. Preparation cannot change the quote calculation or original source data. Fees/FX remain in the administrator-only quote snapshot; finance sees only CAD source cost, CNY draft total, references, notes, version IDs and status through a scoped RPC. Neither raw API responses nor private FX/evidence are projected. The new tables have no direct authenticated grants; all mutations and finance projections use capability-checked security-definer functions with MFA.

The preparation link copies the existing quote's calculated result; it does not turn an agreement reference into an enforceable contract or certify an arbitrary quote as billable. No customer publication, scheduled collection, refund, intercompany remittance, tax calculation or money movement is added. Before future posting, recompute/validate the quote, recheck authorization and agreement approval, serialize unique organization/account/month posting, enforce sufficient funds, and atomically link the client statement to exactly one immutable ledger entry. Multiple reviewed drafts must never create duplicate client charges.
