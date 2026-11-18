# Retired customer homepage

The early `/[locale]/account` homepage is retired. It no longer renders its former public-header/dashboard combination. Its route remains only as a compatibility redirect: plain requests go to `/[locale]/access`; validated wallet bookmarks go to `/[locale]/account/transactions?wallet=...`. The destination retains authentication and wallet authorization. No records, SQL policies or financial calculation were removed.

The current overview exposes company records, applications and project progress under its other-services disclosure. Wallet entries retain access to bank instructions and historical monthly reports. Saved payment notices have their own page. Statement, service, application, company, project and historical-report return links point to the current overview; default legacy phone/test-login destinations also use it, while validated document return targets remain intact.

Independent `/account/*` detail routes are active business features, not obsolete homepages. Keep their scoped database reads and existing project, contract, report and application records. Do not delete these merely because their URL begins with `/account`.

Scope: authenticated client navigation on Preview; public marketing pages and Production are unchanged.
