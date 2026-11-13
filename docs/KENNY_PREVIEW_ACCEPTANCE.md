# Kenny at Remax: real source, isolated acceptance ledger

Owner-approved scope, 2026-11-13 (America/Vancouver): reuse the owner's existing authorized advertising source in Preview. Do not initiate real bank receipts/transfers, send payable invoices, migrate test balances/statements, rebind the advertising account needlessly, or change Production.

## Findings from source review

- `src/lib/ads/report-client.ts` performs GET-only advertising reads. Stored source snapshots do not themselves charge a customer, transfer money or change advertising budgets. This review does not establish the upstream endpoint/credentials are currently valid, or that all upstream account permissions are read-only.
- Existing collections acceptance mode uses `COLLECTIONS_TEST_ORGANIZATION_ID` only in Vercel Preview, the exact dedicated company name 财务流程验收企业（虚构）, CNY wallets and TEST-NOT-PAYABLE-001 / FICTIONAL-TEST-ONLY-001 collection identity. Existing RPC permissions and independent review still apply. This is an application-level acceptance restriction, not a bank sandbox or blanket database isolation policy.
- SQL 025 enforces one statement per draft and account binding/month, with atomic posting; 024/029/030 also enforce independent review, replay/conflict rules and immutable records. These constraints are within one database. They do not deduplicate transactions across Preview and Production.
- Monthly publication now uses the same dedicated-company configuration and persists `[ACCEPTANCE-TEST-NOT-PAYABLE] ` in the immutable statement summary. CSV, printable HTML and download filename/UI visibly mark these statements as nonpayable tests. Previously saved statements for the exact dedicated test company are also visibly marked. Genuine customer statements are not relabelled solely because they reside in Preview. This change is limited to monthly settlement exports; it is not a claim that every historical export/report has a durable test flag.
- Business notifications were not found as an automatic outgoing email/payment action in the reviewed financial paths. Supabase Auth emails are separate, real sends; use only owner-controlled test identities.

## Hosted prerequisites — not verified from local files

Before any financial write, confirm in Vercel that the current Preview deployment uses Supabase `ziijwwbcpuynkaxsbdvg`, and Production uses `rywmjguhvnppfxwhherl`. Check server secret/publishable key belong to the corresponding project without copying values into chat. Production financial flows must not receive the Preview test organization configuration. A local build or public URL alone cannot prove the live deployment configuration.

Locate the existing Kenny at Remax advertiser ID, saved snapshot, currency, timezone, company mapping, and a complete ended month. Keep the real ownership/source record intact. Do not map it to a fictional company and call that its real owner. For the separate acceptance enterprise, only create an explicitly labelled test source copy/reference under the owner's authorization, retaining original source reference and period; if the existing binding does not support this distinction, stop rather than overwrite the original mapping. Test quote, contract and receipt references must begin FICTIONAL-/ACCEPTANCE-, never reuse a real bank reference as a test deposit.

Use the existing dedicated test enterprise if present. Set its UUID in Preview `COLLECTIONS_TEST_ORGANIZATION_ID` and redeploy only after identity is confirmed. The exact company name and CNY wallet are checked before collection writes, and before acceptance statement publication. Do not point this setting at Kenny's ordinary customer ledger. No hosted company, variable, binding or historical ledger has been modified by this code change.

## Acceptance sequence

1. Admin: verify prerequisites, test enterprise/wallet, separate preparer/reviewer/client identities and scoped access; inspect existing drafts and posted statements before reusing a month.
2. Source: reuse an existing authorized snapshot where possible; check account/currency/timezone/completeness. Distinguish real observed spend from fictional pricing/funding assumptions. No new bank movement or advertising write.
3. Collections: configure only the nonpayable test instructions; create a FICTIONAL receipt, independent review; verify balance changes exactly once on replay.
4. Finance: prepare quote and settlement against the explicit test source; self-review must fail; reviewer returns, preparer corrects, reviewer approves.
5. Admin: preview and publish once; repeat submission must not debit twice. Other company publication must be rejected in configured acceptance mode.
6. Client: its own test account reads/downloads/acknowledges only its enterprise. CSV/HTML/printed copy must retain the nonpayable notice. Cross-company access must fail. Test a bill-related service question.
7. Intercompany: only fictional receipt/reference/allocation in the isolated acceptance ledger; independent review/reversal; no actual remittance and no second customer debit.
8. Close: retain test records/audit, do not delete posted money to reset tests, do not export/import these balances or statements into Production.

## Production start

Use the same real advertiser with independently configured Production authorization. Read real source data afresh or verify the approved source copy. Open the formal customer ledger from actual business evidence, not Preview's test closing balance. Check formal bank reference, advertiser/customer/month and existing invoices before posting. Only Production produces the formal financial result. If any real transaction has already been posted in Preview, stop this plan and reconcile/hand over that actual event once; do not charge/collect/pay it again.

## Isolated source-copy entrypoint

The owner confirmed the real Preview enterprise is 温哥华房地产买卖及出租管理, whose October 2026 source was read, matched at CAD 36.24 and handed off; the dedicated acceptance enterprise already shows CNY 1,000.01 and no ad binding. Do not credit it again.

The administrator Ads reporting page now exposes **独立财务验收来源副本** only with the existing Preview test-company configuration. Choose the verified whole-month source, confirm, then create/handoff the copy and return using **返回虚构企业月结工作台**. This does not change the original advertiser or customer ownership. No new SQL migration, key, bank movement, wallet credit, statement or role grant is created.

The endpoint requires Preview deployment, the pinned Preview Supabase project, MFA administrator, exact configured fictional company, and a source for the currently pinned real advertiser already bound to another enterprise. Only matched, complete, boundary-verified CAD calendar-month sources with exact spend/count totals are eligible. A copy has an obvious synthetic account ID, test account name, original snapshot ID/account/company/hash/date provenance and a new fingerprint over the provenance record. Original raw API responses are not duplicated or misrepresented as synthetic API traffic. Amounts and normalized daily data are retained.

A stable synthetic identity is derived from original advertiser + test enterprise across versions/months, so normal per-binding/month publication uniqueness still applies. Deterministic source requests and existing binding/handoff RPCs make unchanged retries idempotent. The three RPCs are separate transactions: a partial failure may leave an unshared source or binding, but never posts money; retry the same source to finish. Do not delete partial records. The entrypoint is blocked in Production even if an operator copies the test setting there.
