# Nigeria Mining Intelligence

A Vercel-ready, source-aware platform for screening the included Nigerian mining-title records. It preserves the original dashboard, licence search, map, analyst, reports, source health check, export, metadata, and API endpoints.

## Architecture

- `index.html`, `app.js`, `styles.css` — dependency-light single-page interface.
- `api/index.js` — Vercel serverless entry point and route dispatch.
- `api/_lib/` — validated data access, intelligence scoring, headers, and rate limiting.
- `data/` — version-controlled curated records and source registry.
- `tests/` and `scripts/validate-data.js` — pre-deployment checks.

## Run checks

Use Node.js 20 or later:

```sh
npm run validate:data
npm test
```

Deploy by importing the repository into Vercel; `vercel.json` routes all `/api/*` requests through the serverless API.

## API

`GET /api/health`, `/api/dashboard`, `/api/licences`, `/api/licences/:id`, `/api/map`, `/api/report?id=:id`, `/api/sources`, `/api/export`, and `/api/metadata` are available. `POST /api/analyse` and `POST /api/sync` remain available. `POST /api/auth/login` is deliberately disabled until credentials are configured.

## Production configuration

Copy `.env.example` values into Vercel Environment Variables only if login is required. Set `NMI_AUTH_EMAIL`, `NMI_AUTH_PASSWORD_SHA256`, and optionally `NMI_AUTH_ROLE`; never commit the real values. The sync route checks only the curated HTTPS source registry and does not import or bypass protected systems.

## Data limitations

The included dataset is curated and not a complete national title register. Map markers are state centroids, not licence polygons. Every screening score is a prioritisation aid, not investment advice; verify current title status and obtain authoritative geometry and due-diligence evidence before action.
