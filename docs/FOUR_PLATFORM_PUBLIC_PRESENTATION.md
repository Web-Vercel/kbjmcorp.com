# Four-platform public presentation

User authorization: 2026-11-10. Add four platform menu entries and a homepage logo/slogan showcase while preserving the original brand, headline, hero and existing sections.

- ChatGPT Ads: current focus.
- Google Ads, Meta Ads and TikTok Ads: strategy consultation; availability and account conditions must be assessed before execution.
- Each entry has a bilingual service detail page and leads to the existing inquiry section.
- This change adds no advertising API integration, database migration or financial behavior.
- Logo provenance is recorded in `public/images/ATTRIBUTION.md`.

Validation: TypeScript and optimized build passed; existing public route checks (31) and homepage browser scenarios (8) passed. `scripts/platforms-smoke.mjs` checks the four entries and logo loading at five widths in both languages, all eight detail routes, inquiry targets and language-switch URLs (18 scenarios). Desktop and mobile screenshots were reviewed locally.

Delivery targets `preview/tenant-isolation` only. Production publication remains separate.
