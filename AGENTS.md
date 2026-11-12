# Project instructions

The user approved the existing public website as the visual and branding baseline. Extend business functionality without redesigning it. Read `docs/APPROVED_HOMEPAGE_BASELINE.md` before work that could affect public pages.

- Preserve the Chinese headline exactly: **让中国品牌，被世界看见。**
- Preserve 智点未来, logo, all existing homepage marketing copy and sections, green-and-white identity, typography, spacing, layout, hero/right-side visual, navigation appearance and language switcher.
- Do not substitute “Smart Clicks. Greater Futures. / 智能触达，成就更大未来”.
- Any technically necessary homepage content/layout change requires the user's explicit approval first. Backend and independent portal/application/admin development may continue within the existing authorization.
- Scope new UI styles to the new pages; shared global CSS and components can affect the approved homepage. Verify relevant public-page regressions.
- Work on `next-rebuild`; do not rewrite/force-push main or change domain, DNS, SSL, email, repository identity or Vercel project identity. GitHub pushes to the development branch are authorized; do not claim a Vercel deployment was verified without evidence.
- Keep public fictional demos distinct from authenticated persisted workflows. Never present an unconfigured database, SMS, payment or advertising API as connected or a business write as successful.


## Authorized static frontend Production release — 2026-11-12
The owner explicitly authorized shipping static frontend design/content to Production and renamed the homepage partnership navigation/label to 合作模式 / Partnership Models. Only an isolated frontend release based on current Production may be pushed to next-rebuild. Keep all existing backend code at the Production baseline; new workspaces, APIs, analytics, identity/permission changes and SQL migrations remain on preview/tenant-isolation. Do not merge Preview wholesale, force-push, change environment variables or alter domain/DNS/deployment settings. Public presentation includes four-platform service pages, partner content/application form through the unchanged inquiry endpoint, and shared logo/error-page presentation.
