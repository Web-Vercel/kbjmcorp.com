# Approved public website baseline

The user explicitly designated https://kbjmcorp.com/zh as the approved public visual and branding baseline. Backend development extends this website; it must not replace its identity. The current development checkout matches the previously reviewed homepage source; this record is not an independent verification of which commit Vercel currently serves.

Preserve the headline exactly: **让中国品牌，被世界看见。**

Preserve 智点未来, its logo, subtitle and introductory paragraphs, green-and-white visual identity, typography, spacing, layout, hero section including the right-side ChatGPT visual, navigation appearance and language switcher, and existing Chinese/English marketing copy. Keep 服务能力, 合作流程, 联系我们 and other existing sections. Do not substitute “Smart Clicks. Greater Futures. / 智能触达，成就更大未来”. Any technically necessary homepage change must first be presented for explicit user approval; no redesign or branding deployment is authorized.

Protected source includes:

- `src/app/[locale]/page.tsx`
- `src/lib/content.ts`, `src/lib/services.ts`, `src/lib/faq.ts`
- `src/components/BrandLogo.tsx`, `HeroVisual.tsx`, `SiteHeader.tsx`, `SiteFooter.tsx`, `MobileNavigation.tsx`, `InquiryForm.tsx`, `Faq.tsx`
- Existing public image assets and homepage selectors in `src/app/globals.css`

New application, portal and administration routes reuse the existing components and design tokens. New styles must be limited to their own page scope; shared global selectors require careful regression review because they may affect the approved homepage.

The application extension adds links on the existing **login and authenticated portal pages**, plus internal staff navigation. The public homepage/header/footer remain byte-for-byte unchanged from development commit `ab8dbe2`; the existing homepage customer-login link leads into the extended flow. No new homepage CTA or navigation styling is needed.

## Explicit user exception — 2026-11-10
The user requested four platform menu entries and homepage logos with core advertising slogans. This supersedes the byte-for-byte restriction above only for the platform navigation rail, mobile platform links, new homepage showcase and associated bilingual platform pages. Existing brand, headline, hero, marketing copy and sections remain preserved. ChatGPT Ads is the current focus; Google Ads, Meta Ads and TikTok Ads are presented for strategy consultation without claiming API connectivity. No Production publication is authorized.

## Explicit user exception — 2026-11-12
Replace “合作流程 / Our process” with “合作伙伴 / Partners” in homepage navigation and the corresponding section. Use the owner's supplied five models (Direct Sales, Referral, Channel, White-label, Affiliate), benefits, application CTA and agreement disclaimer. A bilingual partner application page may reuse the existing inquiry flow and accept individuals as well as teams and companies. Keep the old #process fragment as a compatibility anchor; new navigation uses #partners. All other approved homepage elements remain preserved. No Production publication is authorized by this content change.


## Static frontend Production authorization — 2026-11-12
The owner renamed the public navigation/section label to 合作模式 / Partnership Models and authorized Production publication of static frontend design/content. Ship only a reviewed frontend file allowlist from the current Production baseline; backend workspaces, APIs, auth/permissions, finance, analytics and SQL remain on Preview. This supersedes the earlier no-Production statements for the isolated public/frontend release only.


## Customer-focused homepage revision — 2026-11-12
The owner requested a quieter partnership presence and an honest customer-focused presentation of project progress, charges, receipts, permissions and reports. Add an illustrative information structure without fabricated account metrics; retain detailed partnership models on a separate public page. Preserve brand, headline and hero artwork. Prepare this revision on Preview for review; backend and Production remain unchanged by this iteration.
