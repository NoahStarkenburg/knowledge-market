# KnowledgeMarket

A course marketplace where creators publish courses and learners buy and watch them.
Built as a .NET 9 REST API with an Angular 21 single-page frontend.

## Stack

| Layer | Technology |
|---|---|
| API | .NET 9, ASP.NET Core (minimal APIs + controllers) |
| Data | SQL Server 2022, Entity Framework Core (per-schema migrations) |
| Auth | JWT in an HttpOnly cookie, CSRF double-submit token, role-based policies |
| Cache | Redis (optional; no-op when unconfigured), Azure Managed Redis with Entra ID in Azure |
| Payments | Stripe (one-time and subscription, webhook-driven fulfilment) |
| Storage | Pluggable: local filesystem, S3-compatible, or Azure Blob Storage |
| Frontend | Angular 21 (standalone components, signals), TypeScript, Tailwind CSS |
| Tests | xUnit with Testcontainers (backend), Vitest through the Angular CLI (frontend) |

## Running it locally

**Prerequisites:** [.NET 9 SDK](https://dotnet.microsoft.com/download),
[Node.js 20+](https://nodejs.org), and [Docker Desktop](https://docker.com/products/docker-desktop).

**1. Start the database.**

```bash
docker compose up -d
docker compose ps        # wait until mssql is "healthy"
```

Docker runs the *dependencies*. The app itself runs on your machine, so you keep
the debugger and hot reload.

**2. Start the API.**

```bash
cd src/Api
dotnet run
```

Serves on <http://localhost:5116>, applies EF Core migrations on startup, and
exposes Swagger at `/swagger`.

**3. Start the frontend.**

```bash
cd src/frontend
npm ci
npm start
```

Serves on <http://localhost:4200> and forwards `/api` to the API, so the browser
sees one origin.

**4. Seed sample data (optional).**


```bash
CSRF=$(curl -s -X POST http://localhost:5116/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@knowledgemarket.local","password":"DevAdmin@LocalOnly!"}' \
  -c cookies.txt | jq -r .csrf)

curl -X POST http://localhost:5116/api/dev/bulk-seed -b cookies.txt -H "X-CSRF: $CSRF"
```

The API requires a CSRF token on unsafe methods, so seeding needs a login first.
Generates courses, lessons, and users. Available in Development only.

Sign in with `admin@knowledgemarket.local` / `DevAdmin@LocalOnly!` (from
`appsettings.Development.json`, local use only).

## Configuration and secrets

**No real credential is committed to this repository, and none ever should be.**

Configuration is layered. Later sources override earlier ones:

```
appsettings.json                -> shape and safe defaults, committed
appsettings.Development.json    -> local-only values, committed
dotnet user-secrets             -> your real local secrets, NOT committed
environment variables           -> production values, NOT committed
```

### What is safe to commit, and what is not

The question is never "does it look like a password?" but **what does this value
protect, and who can reach it?**

Safe to commit:

- The local SQL Server password in `docker-compose.yml`. It protects a container
  bound to your own machine, created from that same file. Anyone who can read it
  could already start an identical container.
- Issuer and audience names, bucket names, feature flags, ports, URLs.
- The Azurite account key in `docker-compose.yml`, which Microsoft publishes and
  every Azurite install shares.

Never commit:

- `Jwt:SigningKey`. Anyone holding it can mint valid tokens for any user.
- `Stripe:SecretKey`, `Stripe:WebhookSecret`.
- Real SMTP credentials, OAuth client secrets, cloud access keys.
- Any production connection string.

### Setting local secrets

Secrets live in .NET user-secrets, stored outside this folder at
`%APPDATA%\Microsoft\UserSecrets\<UserSecretsId>\secrets.json`. They are not
encrypted; they are simply somewhere git cannot see. That is the whole point.

```bash
cd src/Api
dotnet user-secrets set "Jwt:SigningKey" "$(openssl rand -base64 48)"
dotnet user-secrets set "Stripe:SecretKey" "sk_test_..."
dotnet user-secrets set "Stripe:WebhookSecret" "whsec_..."
dotnet user-secrets list
```

The app runs without any of these using the Development defaults. Stripe is off
by default (`Stripe:Disabled: true`); set the keys above and flip it to `false`
to enable payments.

### Frontend values are public

The frontend takes four build-time values: `STRIPE_PUBLISHABLE_KEY`,
`GOOGLE_AUTH`, `GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY`. The Angular compiler
**writes them into the JavaScript bundle** that ships to the browser, where anyone
can read them, so there is no way to hide a value there.

Only publishable identifiers belong in the frontend: a Stripe publishable key, an
OAuth client ID. Defaults live under `define` in `src/frontend/angular.json`, and
the Docker image takes real values as build arguments. See
[src/frontend/README.md](src/frontend/README.md).

### In production

Every secret arrives as an environment variable, using `__` for nesting
(`Jwt__SigningKey`, `Stripe__SecretKey`). `ProductionConfigValidator` refuses to
start the app if any required value is missing, too short, or still contains
placeholder text, so a misconfigured deployment fails immediately and loudly
rather than running insecurely.

## Testing

```bash
dotnet test                          # 100 backend tests (Docker must be running)
cd src/frontend && npm test          # 35 frontend tests
cd src/frontend && npm run lint
```

## Architecture

Clean Architecture: **dependencies point inward**, toward the domain.

```
Api  ->  Application  ->  Domain
              ^
        Infrastructure
```

- **Domain.\*** — entities and rules, one project per bounded context. References nothing.
- **Application** — use cases. Declares what it needs as interfaces (ports) in
  `Abstractions/`, and knows nothing about EF Core or HTTP.
- **Infrastructure** — implements those ports: EF Core repositories, and the S3,
  SMTP, Stripe and Redis adapters.
- **Api** — HTTP only, plus the composition root that wires ports to adapters.
- **Shared.Kernel / Shared.Abstractions** — cross-cutting types (`Money`,
  `PagedResult`) and platform ports (`IStorage`, `ICacheStore`) that belong to no
  single context.

The inversion is what makes `Application` testable without a database, which is
why the unit tests run in milliseconds.

There are five bounded contexts — Catalog, Orders, Identity, Content, Cart —
each with its own `DbContext` and its own SQL schema with a separate migration
history. Six repositories still join across those schemas, so the contexts are
not yet independently deployable; breaking those joins is what extracting any of
them into a service would require. Module-per-project was deliberately not
adopted: at this size it would be ceremony without payoff.

See [docs/architecture.md](docs/architecture.md) for detail, plus
[docs/redis-caching.md](docs/redis-caching.md) and
[docs/google-integration.md](docs/google-integration.md).

## Project structure

```
docs/                       Architecture and feature documentation
src/
  Api/                      HTTP: controllers, auth endpoints, composition root
  Application/              Use cases and the ports they depend on
  Infrastructure/           EF Core, plus S3 / SMTP / Stripe / Redis adapters
  Domain.Cart/              Cart aggregate
  Domain.Catalog/           Courses and reviews
  Domain.Content/           Lessons and lesson assets
  Domain.Identity/          Users, roles, authentication
  Domain.Orders/            Orders, subscriptions, enrolment
  Domain.Contracts/         Request and response DTOs
  Shared/
    Shared.Kernel/          Money, PagedResult, exceptions, diagnostics
    Shared.Abstractions/    IStorage, IContentStorage, ICacheStore
  frontend/                 Angular SPA
tests/
  UnitTests/                Domain and service unit tests
  IntegrationTests/         Full HTTP tests against a real SQL Server container
```
## License

[MIT](LICENSE)
