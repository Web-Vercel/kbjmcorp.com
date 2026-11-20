# Investor workspace presentation — November 20, 2026

The owner reported that a provisioned investor account still looked like the old portal. Diagnosis: access/layout used the legacy BusinessNavigation shell for investor roles, while the investor catalog page rendered all categories as a flat wrapping link row. Overview and analytics also duplicated logout controls.

Preview correction: the authenticated investor branch now uses the same existing admin-app/sidebar/topbar classes, brand mark, compact workspace rules and identity/value colors as the current business management center. A separate investor menu groups all 49 existing catalog sections into clients/projects, advertising/sources, finance/settlement and service/operations. It links only to existing investor read routes, overview, analytics and account security; it does not reuse the administrator action menu. Mobile navigation uses the existing compact toggle pattern. Language switching preserves current filters/pagination. Catalog tables have scoped readable headers/borders and retrieved-data colors. Overview, records, analytics and security share this shell; client/sales/agent layout branches remain unchanged.

No RPC, API, database, role, MFA, data projection, financial authority or export behavior changes. Investor access is still verified by getLiveContext and the existing role-specific page guards. The server renders the shell only for investor identity. Existing read-only notice and denied-category behavior remain. No old fictional demo route is reopened. Local visual fixtures are clearly fictional and are not included in application routes or persisted business data.

Validation: 50 focused shell/page/navigation/client/analytics tests passed; optimized build passed; eight bilingual static-shell browser scenarios at 375/768/1024/1440px show no page overflow or overlapping shell regions. Screenshots inspected at desktop/mobile. All catalog entries are covered exactly once by menu tests. These are local fixtures, not a claim of authenticated hosted investor acceptance.

Release scope: Preview first for the reported Investor Demo account. No Production publication or schema migration in this correction. Public marketing pages and other roles retain their existing styles.

## Amount display correction

Owner screenshots identified six-decimal advertising spend/CPC/CPM and raw integer minor-unit ledger amounts. Dashboard monetary display now rounds micros and rational unit costs to exactly two decimals using BigInt. Investor catalog fields ending in _minor or _micros convert to currency units with two decimals; headers no longer claim minor/micro units. Counts, IDs, basis points and exchange rates remain untouched. Stored values, calculations, RPCs, permission scope and existing exact CSV exports are unchanged. Examples: CAD152.640000→152.64, CPC1.496471→1.50; ledger -8480 cents→−84.80 and 100001 cents→1,000.01. Preview only.
