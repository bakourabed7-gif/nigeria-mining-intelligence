# Nigeria Mining Intelligence

Nigeria Mining Intelligence is a Vercel-ready, source-aware Nigerian mining-title platform. Phase 1 adds a public landing page, durable account architecture, role-based feature gating, and installable PWA support while preserving the original dashboard, licence search, mining map, analyst, reports, sources, API routes, and curated mining data.

## Architecture

- `index.html`, `app.js`, `styles.css` — responsive single-page landing and authenticated intelligence application.
- `api/index.js` — Vercel serverless route entry point, authentication, authorization, feature gates, and retained mining APIs.
- `api/_lib/auth.js` — bcrypt password hashing, opaque token session handling, secure cookie policy and role checks.
- `api/_lib/db.js` — PostgreSQL connection layer, configured solely through `DATABASE_URL`.
- `database/schema.sql` — users, sessions, plans, password-reset token structure, saved licences, reports, and analysis history.
- `data/` — curated source registry and mining records; this remains version controlled and is not used for user accounts.
- `manifest.webmanifest`, `service-worker.js`, `icons/` — installable PWA shell.

## Local setup

1. Install Node.js 20 or later and PostgreSQL (or create a managed Postgres database).
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL`.
3. Install dependencies with `npm install`.
4. Apply the schema with `npm run db:migrate`.
5. Run `npm run db:audit`, `npm run validate:data` and `npm test`.
6. Run locally with your preferred Vercel-compatible runtime, for example `npx vercel dev`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` or `POSTGRES_URL` | Yes for authentication | PostgreSQL connection string; Vercel's Neon integration injects `POSTGRES_URL`. Never expose either value to the browser. |
| `NODE_ENV` | Vercel sets it | Enables `Secure` session cookies in production. |
| `APP_URL` | Later reset-email integration | Canonical app URL for password-reset links. |
| `EMAIL_FROM` | Later reset-email integration | Sender address for password-reset email. |

## Authentication and roles

New registrations are assigned the `free` role and plan. Passwords are bcrypt-hashed, while sessions use random opaque tokens: only a SHA-256 token digest is stored in PostgreSQL. The browser receives an `HttpOnly`, `SameSite=Lax`, production-`Secure` cookie; no credential or database secret reaches frontend code.

Roles are `free`, `professional`, `investor`, and `admin`. Free accounts receive a maximum three-result basic licence preview, map and official-source access, and qualitative potential labels rather than numeric AI scores. Professional (₦50,000/month or ₦500,000/year) unlocks full search, numeric scoring, analysis, reports, exports and saved opportunities. Investor (₦150,000/month or ₦1,500,000/year) adds advanced due diligence, comparison, risk, portfolio and investor-intelligence entitlements. Enterprise / Corporate is contact-only preparation for future multi-user, API and data-access offerings. The admin-only source-health check remains protected. Payments and plan-change administration are intentionally out of scope for Phase 1.

The password-reset request endpoint and schema are present, but actual delivery must be connected to a transactional email provider before enabling reset emails.

## API

Public: `GET /api/health`, `GET /api/metadata`, and `GET /api/sources`.

Authentication: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, and `POST /api/auth/forgot-password`.

Authenticated mining APIs: `GET /api/dashboard`, `/api/licences`, `/api/licences/:id`, `/api/map`, `/api/report?id=:id`, `/api/export`, `POST /api/analyse`, `GET|POST|DELETE /api/saved-licences`, and `POST /api/sync` (admin). Server-side checks enforce login, role, and premium gates; the UI mirrors these states but is not relied upon for authorization.

## Vercel deployment

1. Import the feature branch in Vercel or connect the repository.
2. Provision managed PostgreSQL and add `DATABASE_URL` in Vercel Environment Variables, or use Vercel's connected Neon integration which supplies `POSTGRES_URL`.
3. Run the database migration against that database before enabling sign-up.
   Then run the read-only `npm run db:audit` command to confirm the required tables and columns.
4. Deploy. `vercel.json` forwards all `/api/*` calls to the serverless handler and applies security headers.
5. Verify account creation, cookie settings on the production HTTPS domain, protected routes, and all official source URLs.

## PWA installation

The app includes a manifest, standalone display mode, service worker, theme colours, and maskable SVG placeholder icons. Android browsers expose an install prompt when eligible. On iPhone/iPad, use Safari’s **Share → Add to Home Screen**. Replace the SVG placeholders with branded 192×192 and 512×512 PNG icons before app-store distribution.

## Data limitations

The included dataset is curated rather than a complete national title register. Map markers are state centroids, not licence polygons. Screening scores are prioritisation aids, not investment advice; always verify title status, geometry, geology, approvals, and economics with authoritative evidence.
