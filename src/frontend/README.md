# Frontend

The KnowledgeMarket single-page app: course catalog, lessons, checkout, creator tools and an
admin panel.

Angular 21 (standalone components, signals), TypeScript, Tailwind CSS 3, `@stripe/stripe-js`
and `lucide-angular`. Unit tests run on Vitest through the Angular CLI; lint is angular-eslint.

## Running

Start the database and the API first (see the main README), then:

```bash
cd src/frontend
npm ci
npm start          # http://localhost:4200
```

The dev server forwards `/api` to the API on `http://localhost:5116` (see `proxy.conf.mjs`), so
the app and the API share one origin, exactly as they do behind nginx and Front Door.

| Script | What it does |
|---|---|
| `npm start` | dev server on :4200 |
| `npm run build` | production build into `dist/frontend/browser` |
| `npm test` | unit tests, once |
| `npm run lint` | angular-eslint |

## Layout

- `src/app/core/api` - `types.ts` (the API contracts), `api.service.ts` (every backend call;
  components never touch `HttpClient`), `api.interceptor.ts` (cookies, the `X-CSRF` header,
  and one shared refresh-and-retry when a session expires)
- `src/app/core` - auth state, route guards, session expiry, Stripe and Google Drive helpers
- `src/app/shared/ui` - primitives: button, card, field, alert and so on
- `src/app/layout` - navbar, footer, app shell
- `src/app/features` - one folder per feature: auth, courses, orders, settings, admin, legal

Auth is an HttpOnly JWT cookie plus a CSRF double-submit token. The app keeps display state
only, never tokens. Route guards are for the user experience; the API enforces access.

## Build-time configuration

Four public values are compiled into the bundle: `STRIPE_PUBLISHABLE_KEY`, `GOOGLE_AUTH`,
`GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY`. Their defaults (empty, off) live under `define` in
`angular.json`, and the Docker image takes them as build arguments. Anyone can read them in the
browser, so a secret must never be set this way.
