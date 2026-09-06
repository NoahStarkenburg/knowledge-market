# KnowledgeMarket

A course marketplace where creators publish courses and learners buy and watch them.
Built as a .NET 9 REST API with a React 19 single-page frontend.

## Stack

| Layer | Technology |
|---|---|
| API | .NET 9, ASP.NET Core (minimal APIs + controllers) |
| Data | SQL Server 2022, Entity Framework Core (per-schema migrations) |
| Auth | JWT in an HttpOnly cookie, CSRF double-submit token, role-based policies |
| Cache | Redis (optional; falls back to a no-op cache when unconfigured) |
| Payments | Stripe (one-time and subscription, webhook-driven fulfilment) |
| Storage | Pluggable: local filesystem or S3-compatible object storage |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Router |
| Tests | xUnit (backend), Vitest + Testing Library (frontend), Playwright (e2e) |

## Architecture

The backend is a layered ASP.NET Core app organised by bounded context, with
`Controller -> Service -> Repository` inside each. Domain projects
(`Domain.Catalog`, `Domain.Identity`, `Domain.Orders`, and so on) hold entities and
rules; `Application` holds use-case services; `Infrastructure` holds EF Core
persistence; `Api` holds HTTP concerns only and never touches a `DbContext`.

See [docs/architecture.md](docs/architecture.md) for detail, plus
[docs/redis-caching.md](docs/redis-caching.md) and
[docs/google-integration.md](docs/google-integration.md).

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
npm run dev
```

Serves on <http://localhost:5173>.

**4. Seed sample data (optional).**

```bash
curl -X POST http://localhost:5116/api/dev/bulk-seed
```

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
- Anything in `.env.example`, which carries dummy values on purpose.

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

### Frontend variables are public

Anything named `VITE_*` is **baked into the JavaScript bundle at build time** and
shipped to the browser, where anyone can read it. Vite performs a literal text
substitution, so there is no way to hide a value there.

Only publishable identifiers belong in the frontend: a Stripe publishable key, an
OAuth client ID, an API base URL. See [src/frontend/.env.example](src/frontend/.env.example).

Copy it to `.env.local` (gitignored) to set real values:

```bash
cd src/frontend
cp .env.example .env.local
```

### In production

Every secret arrives as an environment variable, using `__` for nesting
(`Jwt__SigningKey`, `Stripe__SecretKey`). `ProductionConfigValidator` refuses to
start the app if any required value is missing, too short, or still contains
placeholder text, so a misconfigured deployment fails immediately and loudly
rather than running insecurely.

## Testing

```bash
dotnet test                          # 97 backend tests
cd src/frontend && npm run test      # 267 frontend tests
cd src/frontend && npm run lint
```

## Project structure

```
docs/                     Architecture and feature documentation
src/
  Api/                    HTTP layer: controllers, endpoints, auth, storage providers
  Application/            Use-case services
  Infrastructure/         EF Core persistence and repositories
  Domain.Contracts/       Request and response DTOs
  Domain.Primitives/      Shared value types (Money)
  Domain.Cart/            Cart aggregate
  Domain.Catalog/         Courses
  Domain.Content/         Lessons and lesson assets
  Domain.Identity/        Users, roles, authentication
  Domain.Media/           Uploaded media
  Domain.Orders/          Orders and enrolment
  Domain.Payments/        Payment records
  Domain.Search/          Search
  frontend/               React SPA
tests/
  UnitTests/              Domain and service unit tests
  IntegrationTests/       Full HTTP tests against the API
```

Every project lives under `src/`, with tests as a sibling tree. Project folder
names match their `.csproj` names exactly, so a path always tells you which
assembly you are looking at.

## License

[MIT](LICENSE)
