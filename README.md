# new-kbjm

Clean, independent React/Vite/Tailwind website for KBJM International Trading.

## Development

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

Editable company information, offices, sectors, team members, and trade listings are centralized in `src/data/siteContent.js`.

## Contact form

The contact form validates locally and submits through `src/services/contactService.js`.

Optional environment variable:

```text
VITE_CONTACT_ENDPOINT=
```

If no endpoint is configured, the form does not report a false success and directs visitors to KBJM’s published email address. Never store an API key in a browser-visible `VITE_` variable.

## Vercel

- Framework preset: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

## Owner-confirmation items

- Resolve the Vancouver address conflict between 1030 W Georgia Street and 1486 W Hastings Street.
- Confirm office hours, team names/roles, trading listings, and the B.C. Eagle Ridge Resource relationship.
- Confirm any statistics before adding them: annual volume, years of experience, partners, and countries served.
- Connect the contact form to a secure server endpoint.

This project is a standalone public website without the previous platform’s runtime, database, authentication, admin dashboard, or hosted asset URLs.
