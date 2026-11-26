# Separate monthly automation, manual processing and shared review

Preview presentation change only. The Monthly settlement navigation now has three role-filtered entries:

- `/operations/monthly-automation`: administrator-only account opt-in/settings and durable worker job history; links prepared jobs to the exact draft and failed/retry jobs to scoped manual recovery.
- `/operations/monthly-manual`: permitted staff links to source reading, ownership, coverage, pricing and explicit manual preparation; no automation configuration or activation changes.
- `/operations/settlements`: shared draft review, funding checks and publication receipts. Manual preparation is available only via `mode=prepare`, selected from the manual area. Existing URLs remain usable; the workbench's preparation-needed action now includes that mode.

Administrator sidebar defaults to automation, finance staff to shared review. Company/month survive tab navigation; mutation, agreement and edit parameters do not. Overall progress remains at the legacy month-close URL, without duplicated automation configuration or preparation controls. Source and pricing tools retain existing URLs and guards. Drafts show automatic/manual origin from the existing canonical preparation note markers; this is a presentation label, not an authorization decision.

No changes to jobs, settings, fees, calculation, wallet entries, independent review, publication, SQL or Production. GET navigation does not activate/pause automation, transfer a task, prepare a draft or debit a wallet. “Open manual processing” is a navigation link and does not cancel the background task; the manual page explicitly warns to inspect existing work before preparing. Existing server/database checks remain authoritative.
