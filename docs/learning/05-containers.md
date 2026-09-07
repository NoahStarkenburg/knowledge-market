# Phase 5: Containerizing the application

## Goal

One command builds the API into an image that runs anywhere, as a non-root
user, on a 275MB base, with no configuration baked in.

```bash
docker build -f src/Api/Dockerfile -t knowledge-market-api .
```

## Why it matters

"Works on my machine" is a real class of bug. A container fixes the runtime, the
OS libraries, the ICU data and the file layout, so the thing that passed CI is
byte-for-byte the thing that runs in production.

The interview question is almost never "write a Dockerfile". It is one of:

- *Why is your image 1.2GB?*
- *Why does your build take four minutes when only one file changed?*
- *Why is this container running as root?*

Every one of those is answered by a specific decision in the file below.

## Concepts

### A Dockerfile and a compose file solve different problems

This trips up most people, so be precise about it:

| | `docker-compose.yml` | `src/Api/Dockerfile` |
|---|---|---|
| Packages | nothing | the API |
| Runs | the dependencies (SQL Server) | the app |
| Used by | you, locally | CI, staging, production |
| Lifetime | while you develop | every deploy |

In this repo you develop with the app on your host (`dotnet run`) and the
database in a container. You keep the debugger and hot reload; you still get a
real SQL Server. The Dockerfile exists for everything downstream of your laptop.

### Multi-stage builds: build fat, ship thin

A .NET build needs the SDK — MSBuild, Roslyn, NuGet — about 850MB. Running the
app needs only the ASP.NET runtime, about 220MB.

A single-stage build ships both, and the result is a production container that
contains a **compiler**. That is not just wasted disk. If someone achieves
remote code execution, an image with a compiler and a package manager lets them
build and run new tooling in place; an image without one makes them work much
harder.

```
FROM sdk AS build      ->  compile, publish to /app/publish
FROM aspnet AS runtime ->  COPY --from=build /app/publish
```

Only what stage 2 explicitly copies survives. Stage 1 is discarded.

Measured on this repo: **275MB** final, against roughly 1.1GB for the naive
single-stage equivalent.

### Layer caching, and why the .csproj files are copied twice

Docker caches each instruction. It reuses a cached layer when the instruction
and the files it copies are unchanged — and it hashes **content**, not
timestamps, so `touch` alone does not invalidate anything.

The naive Dockerfile does this:

```dockerfile
COPY . .
RUN dotnet restore    # slow, hits nuget.org
RUN dotnet publish
```

Change one line in one endpoint and `COPY . .` is invalidated, so restore is
invalidated, so you re-download every package on every build.

The fix is to notice that restore's real inputs are the `.csproj` files and
nothing else:

```dockerfile
COPY src/Api/Api.csproj src/Api/       # ...and one line per project
RUN dotnet restore src/Api/Api.csproj  # cached until a dependency changes
COPY src/ src/                         # changes on nearly every commit
RUN dotnet publish --no-restore
```

Proof, after changing a line in `Program.cs`:

```
#20 [build 14/16] RUN dotnet restore src/Api/Api.csproj
#20 CACHED
#21 [build 15/16] COPY src/ src/
#21 DONE 0.1s
#22 [build 16/16] RUN dotnet publish ...
```

Restore is skipped entirely. A rebuild after a source change takes **10
seconds**; a cold build takes minutes.

Two details that are easy to get wrong:

- **`--no-restore` on publish.** `dotnet publish` restores implicitly. Without
  this flag it silently restores a second time and all the work above buys you
  nothing.
- **`.dockerignore` must exclude `obj/`.** Restore writes
  `obj/project.assets.json` inside the image. If the host's `obj/` folders were
  copied in by `COPY src/ src/`, they would overwrite it, and `--no-restore`
  would fail or link the wrong assemblies. That is why the two files are coupled.

### The build context

`docker build .` tars the entire directory and uploads it to the daemon *before
the first instruction runs*. Without a `.dockerignore`, that is `node_modules`
(300MB, 40,000 files), every `bin/` and `obj/`, and `.git`.

It is also a security boundary. Anything in the context can be copied into a
layer, and **deleting a file in a later instruction does not remove it from the
layer that added it** — `docker history` and any registry still have it. Keep
secrets out of the context rather than deleting them later.

Note the paths in this Dockerfile: `COPY src/Api/Api.csproj`, not
`COPY Api.csproj`. The build context is the repository root, because the API
needs eleven sibling projects. The `-f` flag says where the Dockerfile lives;
the trailing `.` says what the context is. They are independent.

### Do not run as root

Containers run as root unless told otherwise, and root in the container is uid 0
on the host kernel. Namespaces separate them, but every container escape in the
last decade has been more dangerous because of it.

```dockerfile
RUN adduser --system --uid 10001 --group --no-create-home appuser
USER appuser
```

The UID is pinned rather than auto-assigned for two reasons: file ownership on a
mounted volume becomes predictable across rebuilds, and Kubernetes'
`runAsNonRoot` can verify a numeric UID without resolving a name.

There is a consequence people miss. Everything copied in is root-owned, so a
non-root process cannot write anywhere under `/app`. This app creates `Storage/`
and `content/` at startup when `Storage:Provider` is `local`, so those two
directories are created and chowned explicitly:

```dockerfile
RUN mkdir -p /app/Storage /app/content \
 && chown appuser:appuser /app/Storage /app/content
```

Verified in the running container:

```
drwxr-xr-x 1 root    root    /app
drwxr-xr-x 2 appuser appuser /app/Storage
drwxr-xr-x 2 appuser appuser /app/content

uid=10001(appuser) gid=10001(appuser)
```

Writable exactly where it needs to be, read-only everywhere else. In a real
deployment you mount a volume or use S3 over those paths anyway, because a
container filesystem is disposable and per-instance — instance A cannot serve a
file instance B wrote.

### Configuration is injected, never baked in

The old version of this file had:

```dockerfile
ENV ASPNETCORE_ENVIRONMENT=Docker    # deleted
```

That is wrong twice over. It referenced `appsettings.Docker.json`, which no
longer exists — but the deeper problem is the principle. If the environment is
baked into the image you need a different image per environment, which means the
thing you tested in staging is not the thing you shipped to production.

**Build once, promote the same artifact.** The image is environment-agnostic;
the environment arrives at run time:

```bash
docker run -e ASPNETCORE_ENVIRONMENT=Staging -e ConnectionStrings__Default=... image
```

The double underscore is .NET's convention for nesting: `Jwt__SigningKey` binds
to `Jwt:SigningKey`, because `:` is not legal in an environment variable name on
most shells.

With the variable unset, .NET defaults to **Production** — the correct default
for an image, because Production is the locked-down path:
`ProductionConfigValidator` refuses to start without real configuration, and the
development-only seeding endpoints are never mapped.

That validator is not theoretical. Running the image with the local compose
connection string produced exactly this:

```
System.InvalidOperationException: Refusing to start in Production with insecure
or missing configuration:
  - ConnectionStrings:Default still contains placeholder text 'dev_only'
```

A misconfigured deploy dies in two seconds instead of running insecurely.

### Logs go to stdout

This app's Serilog configuration writes to the console and to OpenTelemetry,
never to a file. That is deliberate, and it is one of the twelve factors: a
containerized process should treat logs as an event stream and write them to
stdout, letting the platform collect, route and retain them. Writing to a file
inside a container means the logs die with the container and nobody can find
them.

### HEALTHCHECK, EXPOSE, and the exec form

Three small things worth being able to explain:

**`HEALTHCHECK`** marks the container healthy or unhealthy. Docker itself
restarts nothing — the value is that `docker compose` can gate `depends_on` on
it, and schedulers watch it. It points at `/health`, which runs no dependency
checks, and deliberately not at `/health/ready`, which queries SQL Server: a
brief database blip should not mark the app itself dead. Under Kubernetes you
delete this line and declare `livenessProbe` and `readinessProbe` in the
manifest instead, where the scheduler can act on the result.

**`EXPOSE 8080`** publishes nothing. It is documentation, plus a hint for
`docker run -P`. Publishing is `docker run -p 8081:8080`.

Port 8080 rather than Kestrel's usual 5000/5001 because ports below 1024 need
root to bind, and this container is not root.

**`ENTRYPOINT ["dotnet", "Api.dll"]`** is the *exec* form. The shell form —
`ENTRYPOINT dotnet Api.dll` — wraps the process in `/bin/sh`, which does not
forward `SIGTERM`. `docker stop` would then wait its full ten-second grace
period and `SIGKILL` the app mid-request, instead of letting ASP.NET drain
connections. Always use the exec form.

## What is already here

`src/Api/Dockerfile` existed before this phase and was **thoroughly broken** by
the architecture refactor in PRs #10-#15. It:

- copied `src/Contracts/`, which was renamed to `src/Domain.Contracts/`
- copied `Domain.Payments`, `Domain.Media`, `Domain.Search`, `Worker` — all deleted
- never copied `Domain.Cart`, `Domain.Content`, `Shared.Kernel`, `Shared.Abstractions`
- set `ASPNETCORE_ENVIRONMENT=Docker`, pointing at a deleted settings file

It would have failed on the first `COPY`. This is normal, and worth
internalising: **a Dockerfile that nothing runs rots silently.** The compiler
never checks it, the tests never touch it, and it breaks the day you need it.
The fix is CI — building the image on every pull request, which is Phase 5b.

What it already got right, and what was kept: multi-stage, non-root,
healthcheck, and the intent of copying project files before source.

## Tasks

Everything below is already committed. Run it, watch it, and check each result
matches what you expect before moving on.

### 1. Build it

```bash
cd ~/source/repos/knowledge-market
docker build -f src/Api/Dockerfile -t knowledge-market-api:local .
docker images knowledge-market-api:local
```

Expect roughly 275MB.

### 2. Watch the cache work

Change any line in `src/Api/Program.cs`, then rebuild:

```bash
docker build -f src/Api/Dockerfile -t knowledge-market-api:local .
```

`RUN dotnet restore` should print `CACHED`. If it does not, either what you
changed is in the `.csproj` set, or your `.dockerignore` is letting `obj/` in.

### 3. Run it against the compose database

```bash
docker compose up -d          # SQL Server, if not already running

docker run -d --name km-api \
  --network knowledge-market_default \
  -p 8081:8080 \
  -e ASPNETCORE_ENVIRONMENT=Staging \
  -e ConnectionStrings__Default="Server=mssql,1433;Database=km;User Id=sa;Password=Dev_Only_LocalPassword_123!;TrustServerCertificate=true" \
  -e Jwt__SigningKey="$(openssl rand -base64 48)" \
  -e Admin__Email="you@example.com" \
  -e Admin__Password="$(openssl rand -base64 18)" \
  -e Cors__FrontendOrigin="http://localhost:5173" \
  -e Stripe__Disabled=true \
  knowledge-market-api:local
```

Two things to understand in that command:

- `--network knowledge-market_default` joins the compose network, which is why
  the host is `mssql` — Docker's embedded DNS resolves service names. Without
  it you would need `host.docker.internal`, which only works on Docker Desktop.
- `ASPNETCORE_ENVIRONMENT=Staging` is there because the compose password
  contains `Dev_Only` and `ProductionConfigValidator` rejects it. That is the
  guard doing its job, not a bug.

### 4. Break it on purpose

Drop `-e ASPNETCORE_ENVIRONMENT=Staging` and run again. The container should
exit immediately. Read the reason:

```bash
docker logs km-api
```

### 5. Clean up

```bash
docker rm -f km-api
```

## Verify

```bash
docker ps --filter name=km-api --format '{{.Status}}'   # Up ... (healthy)
docker exec km-api id                                   # uid=10001(appuser)
curl -i http://localhost:8081/health                    # 200
curl -i http://localhost:8081/health/ready              # 200 — SQL reachable
curl -i http://localhost:8081/api/courses               # 401 — auth is on
```

`(healthy)` is the one that matters: it means the `HEALTHCHECK` ran inside the
container and the app answered itself.

## Questions

1. Your final image is 1.2GB. What is the single most likely cause, and what
   does the fix look like?
2. You changed one line of C# and the build re-downloaded every NuGet package.
   Which instruction is in the wrong place?
3. Why must `.dockerignore` exclude `obj/` for this Dockerfile specifically?
4. Why is `ASPNETCORE_ENVIRONMENT` not set in the image, and what breaks if you
   set it?
5. The container runs as `appuser` and file uploads fail with
   `UnauthorizedAccessException`. Why, and what are the two possible fixes?
6. You committed a `.env` file, then added `RUN rm .env` to the Dockerfile. Is
   the secret gone from the image? Explain.
7. What is the difference between `EXPOSE 8080` and `-p 8080:8080`?
8. Why does the healthcheck hit `/health` and not `/health/ready`?

## Next

Phase 5b: build the image in CI on every pull request so it cannot rot again,
add a Dockerfile for the frontend, and stand up the four environments — dev, qa,
staging, prod — as configuration rather than as four images.
