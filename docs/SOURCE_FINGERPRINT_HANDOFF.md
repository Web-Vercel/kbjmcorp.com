# Source PDF handoff fingerprints

The protected operations source-registration form accepts a report month rather than an arbitrary date. The API normalizes YYYY-MM to the first day and retains compatibility with existing YYYY-MM-01 requests; other dates remain invalid.

Staff may select an original PDF (up to 25 MiB). The browser checks its PDF header and computes SHA-256 from exact file bytes with Web Crypto. Only the digest is submitted with the existing source metadata. The file picker has no form field name; no file content or filename is sent or persisted by this feature. The original must remain in the operating company's controlled document archive. Existing manual digest entry remains available.

Selecting another file, clearing or resetting the form invalidates pending hash calculations so a stale result cannot replace the current digest. While hashing or after an invalid file, browser form validity prevents submitting an unfinished digest; clear the selection to continue without one. Source cards expose the registered fingerprint to already-authorized source/finance staff for comparison.

A matching digest shows file byte identity, not origin authenticity, correctness of spend, authorization, platform access or evidence approval. PDF header checking is a convenience check, not full PDF validation. This is not private file upload/storage, automatic extraction, translation, statement publication or ledger posting. No new SQL migration is needed.

Verification: local unit and UI checks cover exact-byte hashes, changed contents, non-PDF and size rejection, metadata-only submission, form reset and reporting-month normalization. Hosted source registration still requires user acceptance with a fictional report and authorized account.
