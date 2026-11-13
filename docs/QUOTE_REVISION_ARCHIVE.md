# Quote revisions and archive

Apply `supabase/migrations/019_quote_revision_archive.sql` after migration 018. Suggested SQL Editor name: `15 报价修订与归档权限—已执行`.

Administrators with MFA use one calculator to create a quote or load a saved quote. Loading restores the saved inputs; calculation and explicit saving create a new immutable version with a parent reference. The original remains unchanged. Automatic reference quotes require fetching the current reference again before calculating; the old reference is not treated as current. Unsupported or malformed snapshots fail closed.

Archive and restore require a reason and confirmation. They change a separate lifecycle record, retain original amounts and provenance, and write an audit event. State revisions protect against conflicting updates. Archived quotes leave the default history list; select “包括已归档报价” to restore them. There is no hard-delete action.

Finance staff see authorized result totals, including archived history when requested. Only administrators can load private inputs, revise, archive or restore. Database functions enforce these permissions independently of the interface.

The duplicate new fee-rule form has been removed. Existing fee-rule drafts remain available in a collapsed read-only history section and are not automatically applied to quotes.

These are internal drafts. Calculation, saving, revision and archive do not establish customer acceptance, publish a statement, create receivables/payables, or change wallet entries. No production branch or financial data is modified by installing this migration.
