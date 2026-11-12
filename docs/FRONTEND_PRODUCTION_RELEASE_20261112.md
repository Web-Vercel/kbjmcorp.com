# Static frontend Production release

Owner authorization: 2026-11-12, America/Vancouver.

Production base: `e40e6a141a872924e7663976ff6385cb284bc6f9`. Backend development remains on `preview/tenant-isolation`.

Included: four-platform public presentation and brand assets; homepage 合作模式 / Partnership Models content; public partner application form using the existing inquiry endpoint; shared company branding and branded error pages.

No API, authentication, proxy, database, staff/account workspace, business permissions, financial logic or dependency changes are included. No SQL, configuration, domain or DNS changes are needed.

Explicit frontend file allowlist:

- `next.config.ts`
- `src/app/(entry)/layout.tsx`
- `src/app/[locale]/layout.tsx`
- `src/app/global-error.tsx`
- `src/app/global-not-found.tsx`
- `src/app/[locale]/page.tsx`
- `src/app/[locale]/partners/apply/page.tsx`
- `src/app/[locale]/platforms/[slug]/page.tsx`
- `src/components/CompanyPageBrand.tsx`
- `src/components/CompanyPageBrand.module.css`
- `src/components/PartnersSection.tsx`
- `src/components/PartnersSection.module.css`
- `src/components/PlatformNavigation.tsx`
- `src/components/PlatformShowcase.tsx`
- `src/components/PlatformShowcase.module.css`
- `src/components/InquiryForm.tsx`
- `src/components/MobileNavigation.tsx`
- `src/components/SiteHeader.tsx`
- `src/lib/content.ts`
- `src/lib/partners.ts`
- `src/lib/platforms.ts`
- `public/images/ATTRIBUTION.md`
- `public/images/platforms/google-ads.svg`
- `public/images/platforms/meta.svg`
- `public/images/platforms/tiktok.svg`
- `scripts/platforms-smoke.mjs`
- `tests/inquiry-form.test.tsx`
- `docs/APPROVED_HOMEPAGE_BASELINE.md`
- `docs/FOUR_PLATFORM_PUBLIC_PRESENTATION.md`

Policy/release documentation is included alongside this list.

Verification before release: optimized build and TypeScript passed; 18 inquiry/navigation tests passed; 12 bilingual partner browser scenarios passed at 320/390/768/851/900/1440px; 18 four-platform public presentation checks passed. All browser form submissions were mocked. Compared against the Production base, API, auth, proxy, backend workspace, financial logic, database and dependency paths are unchanged.
