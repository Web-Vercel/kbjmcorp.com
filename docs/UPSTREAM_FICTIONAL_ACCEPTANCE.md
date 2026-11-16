# Fictional intercompany acceptance

The owner requested a short, visually explicit test flow without attesting a nonexistent bank payment. Reuse the existing `COLLECTIONS_TEST_ORGANIZATION_ID` allowlist, only when `VERCEL_ENV=preview` and the verified company name is 财务流程验收企业（虚构）. No new migration or environment variable is required.

The test form prefills the sole outstanding statement and amount, labels the simulated date/amount, creates a plainly fictional PDF and local SHA-256, and uses a fictional-only confirmation. A separate authorized account still reviews the record. It does not initiate a bank transfer or touch client balances.

The API verifies the Preview allowlist and stored company name, requires TEST-UPSTREAM- references and exact FICTIONAL TEST ONLY - NO BANK TRANSFER evidence/note, and checks the PDF hash against the submitted reference/date/amount. Non-test submissions for the configured test company are rejected, as are test references on the normal path. Real companies retain actual receipt evidence and independent review. Existing database permissions, allocation limits, duplicate checks and immutable history remain authoritative.

This is not a separate sandbox database. Fictional registrations persist in the dedicated fictional company's existing workflow with explicit reference/evidence labels; CSV exports retain those identifiers. They must not be represented as bank evidence or included in formal accounting. Existing records are not relabeled or modified.

Hosted acceptance: keep company 财务流程验收企业（虚构）, procurement month 2026-10. Confirm no registration first. Generate the fictional PDF for CAD45.30, then submit once; check pending allocation CAD45.30 and verified allocation CAD0. Another finance reviewer checks the fictional PDF and approves. Expected final: verified45.30, outstanding0, pending0. This is a test expectation, not a claimed hosted result. Do not repeat submissions after uncertain results; inspect the original record first.
