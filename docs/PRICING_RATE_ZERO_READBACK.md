# Preview pricing save feedback

Owner SQL screenshot confirms revision 4 for the fictional finance acceptance organization, effective 2026-10-01, stores transfer_bps = 0 while the other two fields inherit defaults. No SQL or data rewrite is required.

Pricing saves now return and validate the inserted row. The settings display the confirmed revision and effective rates immediately, retaining that receipt during refresh. The calculator remounts when the selected rate revisions change. Other AdminForm consumers retain their existing reload behavior.

Validation: 39 focused tests cover zero overrides, API readback, server rate selection, calculator input, and existing form behavior; TypeScript and production build checked locally. Hosted authenticated acceptance remains pending. Production and migration 055 are unchanged by this fix.
