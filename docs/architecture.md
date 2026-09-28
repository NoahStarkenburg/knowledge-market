# Backend architecture

The API is a layered (n-tier) ASP.NET Core app: **Controller → Service → Repository**,
with a thin domain of anemic-ish entities. It started as a DDD-flavoured modular monolith
and was converted context by context; the HTTP contract (routes, verbs, status codes, JSON)
was held fixed throughout and is pinned by the integration tests.

## Layers

- **`Api` (Controllers)** — HTTP concerns only: model binding, resource-based authorization
  (`IAuthorizationService` + policy shells), cookie/CSRF/rate-limit metadata, file streaming
  and multipart handling. Controllers hold no business rules and never touch a `DbContext`.
- **`Application` (Services + ports)** — transaction-script services that hold the rules,
  plus the abstractions (`Application.Abstractions`) the outer layers implement: repositories,
  `IStorage`, `IContentStorage`, `IPaymentService`. Validation is FluentValidation; entity→DTO
  mapping is AutoMapper. This project references no infrastructure and no third-party SDK
  (EF, Stripe, S3 all stay outside it).
- **`Infrastructure` (Repositories)** — EF Core for writes and most reads; Dapper for the
  catalog search and the `catalog.catalog_stats()` SQL Server function. Repositories translate
  provider exceptions (concurrency, unique-violation) into application exceptions.

`Api/Filters/ApiExceptionFilter` maps application exceptions to status codes:
`ValidationException → 400`, `NotFoundException → 404`, `ConflictException → 409`,
`BadRequestException → 400`, `ForbiddenException → 403`, `PaymentException → 502`.

## Converted contexts

| Context | Controllers | Service(s) | Repository |
|---|---|---|---|
| Users / Profile | `Users`, `AdminUsers` | `UserService` | `UserRepository` |
| Catalog / Courses | `Courses`, `PublicCatalog`, `AdminCatalog` | `CourseService` | `CourseRepository` |
| Orders / Subscriptions | `Orders`, `AdminOrders` | `OrderService` | `OrderRepository` |
| Content / Lessons | `Lessons`, `LessonAssets`, `LessonTexts` | `LessonService`, `LessonAssetService`, `LessonTextService` | `ContentRepository` |
| Uploads / Media | `Uploads`, `CourseMedia` | `UploadService` | `MediaRepository` (+ `ContentRepository`) |
| Creator | `Creator` | `CreatorService` | `CreatorRepository` |
| Webhooks | `Webhooks` | `OrderService` (Stripe stays in the controller) | `OrderRepository` |

## Deliberately still minimal APIs

- **Auth** (`/api/auth/*`: login, register, refresh, logout, verify-email, password reset,
  Google OAuth) — a self-contained, security-critical module. Google OAuth is config-gated
  and tied to the auth scheme, which a controller can't conditionally register.
- **Dev seed** (`/api/dev/*`) — registered only in Development; not production surface.

## Cross-context reads

Repositories reach across contexts through the sibling `DbContext` rather than calling other
services, keeping the modular-monolith boundaries visible (e.g. `ContentRepository` reads the
owning course shell from `CatalogDbContext`; `OrderRepository` reads buyer/course data from
`Users`/`Catalog`; `CreatorRepository` aggregates `Catalog` + `Orders`).
