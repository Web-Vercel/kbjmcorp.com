# Monthly FX automation foundation

Approved policy: convert CAD advertising costs using the last available Bank of Canada daily FXCNYCAD observation within the closed consumption month. Invert CNY→CAD using integer half-up rounding to eight decimal places. Preserve the original quotation, observation date, retrieval timestamp, source URL and billing month. A reference rate is not a bank execution rate.

The admin-only GET /api/admin/fx-reference?month=YYYY-MM now supports that policy. The existing no-month latest-rate estimate behavior is unchanged. Invalid/open months, absent data, duplicate/out-of-period observations and references over seven days before month end fail closed. No estimated fallback or carry-forward from another month.

This is a foundation for the scheduled monthly draft worker, not an enabled automatic billing system. Existing quote editor, snapshot persistence, client statement presentation, independent review and publication are unchanged. The worker must persist this evidence into an immutable quote before publication, and must not re-fetch today's rate for historical billing. Official source reachability was attempted but blocked by the execution network (CONNECT 403); no live observation was verified in this task. No SQL, customer charges or Production changes.
