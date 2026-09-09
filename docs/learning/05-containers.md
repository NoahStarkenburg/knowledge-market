# Phase 5: Containers

Written from zero. If you have never built an image, start at Part 1 and read
straight through. Nothing here assumes you already know a term.

The Dockerfiles in this repository are commented line by line — this document
explains the *ideas*, and the files explain themselves. When a section says
"see `src/Api/Dockerfile`", go read the comments there rather than expecting the
code to be reproduced here.

---

## Part 0 — What we have, and what we are trying to do

### What exists today

| File | What it is | Status |
|---|---|---|
| `docker-compose.yml` | Starts **SQL Server** for local development | merged |
| `src/Api/Dockerfile` | Packages the **API** into an image | merged, PR #16 |
| `.dockerignore` | Filters the context for the API build (context = repo root) | merged, PR #16 |
| `src/frontend/Dockerfile` | Packages the **SPA** — node builds, nginx serves | PR #21 |
| `src/frontend/nginx.conf` | Routing, caching and proxying for the SPA container | PR #21 |
| `src/frontend/.dockerignore` | Filters the context for the web build (context = `src/frontend`) | PR #21 |

Note the two different build contexts. The API needs the repository root
because `Api.csproj` references ten sibling projects. The frontend needs
nothing outside its own folder, so its context is `src/frontend` and its `COPY`
paths are shorter. **Pick the smallest directory containing everything the
build needs.**

Two of those solve completely different problems, and confusing them is the
single most common source of confusion when learning Docker:

|  | `docker-compose.yml` | `src/Api/Dockerfile` |
|---|---|---|
| Packages | nothing | the API |
| Runs | the things the app depends on | the app itself |
| Who uses it | you, while developing | CI, staging, production |
| Lifetime | while you are coding | every deployment |

Right now your development loop is:

```
docker compose up -d      # SQL Server, in a container
cd src/Api && dotnet run  # the API, on your host, with the debugger
cd src/frontend && npm run dev   # Vite, on your host, with hot reload
```

Docker runs the **dependency**. The app runs on your machine, because that is
where the debugger and hot reload are. That is deliberate and it is what most
teams do.

### What we are trying to do

Package the API **and** the built frontend into **one image**, so that a single
`docker run` gives you the whole working application, identically, anywhere.

```
                         ONE image
   ┌───────────────────────────────────────────────┐
   │  ASP.NET runtime                              │
   │                                               │
   │  /app/Api.dll          the compiled API       │
   │  /app/wwwroot/         the compiled SPA       │
   │                                               │
   │  GET /api/courses  →   C# → SQL Server        │
   │  GET /              →  wwwroot/index.html     │
   │  GET /courses/abc   →  wwwroot/index.html     │
   └───────────────────────────────────────────────┘
```

One artifact. One deploy. One origin, so no CORS and no cross-site cookies.
Why that architecture and not two containers or a CDN is covered in
[05a-serving-a-spa.md](05a-serving-a-spa.md); this document is about the
container mechanics.

---

## Part 1 — The three nouns

Almost all early confusion comes from mixing these up.

### Dockerfile — a recipe

A text file. A list of instructions. It does nothing on its own. It lives in
git because it is source code.

### Image — a build output

A read-only snapshot of a filesystem, plus metadata saying what to run when it
starts. Produced by `docker build`. **It is not in git**, it lives in Docker's
own storage.

### Container — a running instance of an image

Produced by `docker run`. You can run the same image ten times and get ten
containers.

### The mapping to .NET

| .NET | Docker |
|---|---|
| `Api.csproj` — committed | `Dockerfile` — committed |
| `bin/Release/net9.0/` — gitignored output | **image** — never in git |
| `dotnet build` | `docker build` |
| `dotnet run` | `docker run` |
| a class | an image |
| an object | a container |

### Where images actually live

```
docker images          # list them
docker rmi <name>      # delete one
```

They sit inside Docker Desktop's Linux VM. Deleting one costs nothing but the
time to rebuild.

### Images never auto-update

This trips up everybody. **An image is frozen at the moment it was built.**

```
edit a .cs file
   ↓  nothing happens to any image
docker build           → creates a NEW image
   ↓  a container that is already running is still on the OLD one
docker rm -f <name> && docker run …    → now the change is live
```

A running container is pinned to the image it started from. Rebuilding does not
touch it. This is why you do not develop inside a container — you would rebuild
on every keystroke. The container is for CI and deployment, where "frozen and
reproducible" is exactly what you want.

---

## Part 2 — Layers

Every instruction in a Dockerfile produces a **layer** — a diff of the
filesystem. The image is those layers stacked in order.

```
Dockerfile                          layers
────────────────────────────────────────────────────────────
FROM dotnet/aspnet:9.0        →     [ base OS + .NET runtime ]
RUN apt-get install curl      →     [ + curl binaries       ]
RUN adduser appuser           →     [ + /etc/passwd entry   ]
COPY --from=build /app/publish →    [ + your app files      ]
```

Three consequences worth internalising.

**Layers are shared.** Ten images built `FROM dotnet/aspnet:9.0` store that base
once. This is why images are smaller on disk than the numbers suggest.

**Layers are cached.** If an instruction and its inputs are unchanged, Docker
reuses the previous layer instead of running it. This is Part 5.

**Layers are immutable, and this is a security trap.** Deleting a file in a
later instruction does not remove it from the layer that added it:

```dockerfile
COPY .env /app/.env      # layer 4: the secret is now in the image, forever
RUN rm /app/.env         # layer 5: the file is hidden, NOT removed
```

Anyone can run `docker history` or unpack the image and read layer 4. The only
correct fix is never to copy it in — which is what `.dockerignore` is for.

A running container adds one thin **writable** layer on top of the read-only
stack. Anything written there vanishes when the container is removed. That is
why data lives in volumes or in a database, never in the container filesystem.

---

## Part 3 — The build context, and why we exclude things

### The daemon cannot see your files

Docker is a client and a server. The `docker` command is the client; the actual
work happens in the **daemon**, which on Windows runs inside a Linux VM. The
daemon has no access to your filesystem.

So when you run:

```bash
docker build -f src/Api/Dockerfile -t knowledge-market-api .
```

that trailing `.` is the **build context** — the directory Docker is permitted
to copy from. Before the first instruction executes, the client tars up that
entire directory and uploads it to the daemon.

The `-f` flag says where the *recipe* lives. The `.` says where the *files*
come from. They are independent, which is why `src/Api/Dockerfile` writes
`COPY src/Api/Api.csproj` and not `COPY Api.csproj`.

**Why the context is the repository root here:** `Api.csproj` references ten
sibling projects. A context of `src/Api/` could not reach them. **Pick the
smallest directory that contains everything the build needs — no smaller, no
larger.**

### What that means in this repository

Measured:

```
whole repository                      541 MB    19,934 files
  bin/ and obj/                       286 MB     2,508 files
  src/frontend/node_modules/          225 MB    15,362 files

what building the API actually needs  1.2 MB
```

Without a `.dockerignore` you upload 541 MB to compile 1.2 MB of input, on
every build.

### `.dockerignore` — the three reasons

Same syntax as `.gitignore`. Sits at the **context root**, so ours is at the
repository root. See the file itself for what each block excludes.

**1. Speed.** Obvious, and the least important.

**2. Correctness.** This is the one that actually breaks builds.

The image runs `dotnet restore` *inside itself*, which writes
`obj/project.assets.json` into each project. A later `COPY src/ src/` would
overwrite that with your Windows version, and `dotnet publish --no-restore`
would fail or link the wrong assemblies. The error message points at NuGet, not
at Docker.

The frontend has the identical problem, worse. Your `node_modules` contains
`@rollup/rollup-win32-x64-msvc` and `@esbuild/win32-x64` — **compiled Windows
binaries**. Copy those into a Linux image and the build dies with
`Cannot find module @rollup/rollup-linux-x64-gnu`, which looks like a broken
dependency and is actually a Dockerfile mistake.

> **The rule: build artifacts are platform-specific. Regenerate them inside the
> image, never ship them in.** `bin/`, `obj/`, `node_modules/`, `dist/`.

**3. Security.** Per Part 2, a file copied into a layer is in that layer
forever. Keep `.env`, `*.pem`, `*.key` and key material out of the context so
they can never be copied in by accident.

### Include and exclude

`.dockerignore` is exclude-only, with `!` to re-include something a broader
pattern caught — same as `.gitignore`:

```
**/dist/          # exclude every dist folder at any depth
*.md              # exclude markdown at the context root
!README.md        # ...except this one
```

`**` matches any number of directories. A single `*` does not cross a `/`.

---

## Part 4 — The instructions

What each one does and when you need it. The *why* for our specific choices is
in the comments in `src/Api/Dockerfile`.

### `FROM image:tag AS name`

Starts a stage from an existing image. Every stage begins with one.

Always pin a version. `node:latest` means your build changes silently when a
new major ships. `AS name` labels the stage so a later `COPY --from=name` can
reference it — without a name you must use a positional index, which breaks the
moment anyone reorders the file.

### `WORKDIR /path`

Sets the working directory for every following instruction, creating it if
needed.

**Use this, never `RUN cd /app`.** Each `RUN` is a separate shell process, so a
`cd` inside one evaporates when it exits:

```dockerfile
RUN cd /app        # this shell exits…
RUN npm ci         # …and this one starts back at /
```

### `COPY src dest`

Copies from the build context into the image.

- **Source** paths are relative to the **context root**.
- **Destination** paths are relative to **`WORKDIR`**.
- With multiple sources the destination must be a directory (end it with `/`).
- **`COPY` merges into the destination; it does not replace it.** Files already
  there survive unless overwritten by name. This is what makes the
  copy-manifest-then-install-then-copy-source pattern in Part 5 work at all.
- `COPY --from=stage path dest` copies out of another stage instead of the
  context. This is the whole mechanism behind multi-stage builds.
- `COPY --chown=user:group` sets ownership as it copies.

There is also `ADD`, which additionally unpacks tarballs and fetches URLs.
**Use `COPY`.** `ADD`'s extra behaviour is surprising and occasionally a
security problem.

### `RUN command`

Executes a command at build time, in a new layer.

Chain related commands with `&&` so cleanup lands in the same layer:

```dockerfile
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
```

Split across three `RUN`s, the package lists would sit in an earlier layer
forever and the `rm` would only hide them. Same trap as Part 2.

### `ENV KEY=value`

Sets an environment variable that persists **into the running container**.

### `ARG KEY=value`

Sets a variable available **only during the build**, and settable from the
command line with `--build-arg`. It does not exist at run time.

> `ARG` for build-time, `ENV` for run-time. **Never pass a secret as either** —
> both are visible in `docker history`. Real secrets arrive at `docker run`, or
> via BuildKit's `--mount=type=secret`.

### `EXPOSE port`

**Documentation only.** It publishes nothing and opens nothing. Publishing is
`docker run -p 8081:8080`. Its real value is telling a reader which port
matters, and giving `docker run -P` something to work with.

### `USER name`

Every instruction after it, and the container itself, runs as that user.
Containers run as **root** by default, and root in the container is uid 0 on
the host kernel.

The consequence people get bitten by: everything `COPY`'d in is root-owned, so
a non-root process cannot write anywhere under `/app`. Any directory the app
writes to must be created and `chown`ed explicitly. See the `mkdir`/`chown`
line in `src/Api/Dockerfile`.

### `HEALTHCHECK`

A command Docker runs periodically inside the container to decide whether it is
healthy.

**Docker itself restarts nothing.** The value is that `docker compose` can gate
`depends_on` on it, and orchestrators watch it. Under Kubernetes you delete this
instruction and declare probes in the manifest, where the scheduler can act.

### `ENTRYPOINT` and `CMD`

What runs when the container starts.

- `ENTRYPOINT` is the executable. `CMD` supplies default arguments.
- `docker run image foo` replaces `CMD`, not `ENTRYPOINT`.
- Two syntaxes, and the difference is not cosmetic:

```dockerfile
ENTRYPOINT ["dotnet", "Api.dll"]   # exec form  — the process is PID 1
ENTRYPOINT dotnet Api.dll          # shell form — /bin/sh is PID 1
```

Shell form wraps your app in `/bin/sh`, which **does not forward `SIGTERM`**. On
`docker stop`, your app never hears the shutdown signal, waits out the ten
second grace period, and gets `SIGKILL`ed mid-request instead of draining
connections. **Always use the exec form.**

---

## Part 5 — Layer caching and instruction order

### How the cache decides

For each instruction Docker computes a key from the instruction text plus, for
`COPY`, a **content hash of the files** being copied. If a cached layer matches
that key, it is reused and the instruction never runs.

Two things follow:

- `touch` changes nothing. Only content matters.
- **Once one layer misses, every layer after it is rebuilt.** The cache is a
  prefix, not a set.

That second point is the entire art of Dockerfile ordering.

### The rule

> **Put what changes rarely near the top. Put what changes constantly near the
> bottom.**

Dependency installation is slow and its inputs change rarely. Source code is
fast to copy and changes on every commit. So:

```dockerfile
COPY <manifest files>      # package.json / *.csproj  — rarely change
RUN <install>              # slow, network-bound, now cached across most commits
COPY <all source>          # changes constantly
RUN <build>                # fast
```

The naive version puts `COPY . .` first, which invalidates the install layer on
every single commit and re-downloads every package every time.

### Making the cached layer actually count

Both ecosystems will silently redo the install unless you tell them not to:

- `dotnet publish --no-restore` — without it, publish restores a second time.
- `npm ci` rather than `npm install` — `ci` installs exactly what the lockfile
  pins, fails if `package.json` and the lockfile disagree, deletes
  `node_modules` first, and never writes to the lockfile. Reproducible by
  construction. `npm install` is for a human adding a dependency.

### Measured on this repository

After changing one line in `Program.cs`:

```
#20 [build 14/16] RUN dotnet restore src/Api/Api.csproj
#20 CACHED
#21 [build 15/16] COPY src/ src/
#21 DONE 0.1s
#22 [build 16/16] RUN dotnet publish ...
```

Restore skipped entirely. Rebuild: **10 seconds**, against minutes cold.

### When caching bites

A cached layer can be *stale but valid*. `RUN apt-get update` cached from three
weeks ago installs three-week-old packages. `docker build --no-cache` forces a
full rebuild; CI should do this periodically.

---

## Part 6 — Multi-stage builds

### The problem

Compiling needs a toolchain. Running does not.

| | Size | Contains |
|---|---|---|
| `dotnet/sdk:9.0` | ~850 MB | MSBuild, Roslyn, NuGet |
| `dotnet/aspnet:9.0` | ~220 MB | the runtime, no compiler |

A single-stage build ships the compiler to production. That is wasted disk, and
worse: an image containing a compiler and a package manager lets an attacker
who achieves code execution build and run new tooling in place.

### The mechanism

```dockerfile
FROM dotnet/sdk:9.0 AS build
...compile, output to /app/publish...

FROM dotnet/aspnet:9.0 AS runtime
COPY --from=build /app/publish ./
```

**Only what the final stage explicitly copies survives.** Everything else is
discarded when the build ends. Measured here: **275 MB** final, against roughly
1.1 GB for the single-stage equivalent.

### Stages are a graph, not a list

This is the part most people never learn.

Docker does **not** run stages top to bottom. BuildKit builds a dependency
graph from the `COPY --from` references and runs everything it can **in
parallel**.

So if a Node stage and a .NET stage do not reference each other, they build
simultaneously — an `npm ci` and a `dotnet restore` overlapping rather than
queueing.

It also means their caches are independent: a CSS change costs no
`dotnet publish`, and a C# change costs no `npm ci`. **Keeping stages
independent is a real design decision with a measurable effect**, and it is why
built frontend files should be copied into the *runtime* stage rather than into
the .NET build stage.

### `--target` — build one stage and stop

```bash
docker build -f src/Api/Dockerfile --target build -t scratch-image .
```

Stops after the named stage and gives you a runnable image of it, so you can
open a shell inside and look around:

```bash
docker run --rm -it scratch-image sh
```

**This is a debugging tool, not a deliverable.** It does not mean that stage is
a separate container you ship. It is scaffolding, frozen for inspection.

It is also used in CI to run a test stage without building the release image.

---

## Part 7 — `docker-compose.yml` and its YAML

### What compose is for

The Dockerfile packages **one** image. Compose runs **several containers
together** — with a network between them, startup ordering, and their
configuration — from one file.

Ours runs exactly one service: SQL Server. That is deliberate. It gives you a
real database with one command while the app stays on your host with the
debugger attached.

### The keys, and what each does

```yaml
services:                 # every container compose manages
  mssql:                  # the SERVICE NAME — also its DNS hostname
    image: ...            # which image to run (vs `build:` to build one)
    container_name: ...   # fixed name for docker ps / docker logs
    environment:          # env vars passed into the container
    ports:                # "HOST:CONTAINER" — publish a port to your machine
    volumes:              # persistent storage
    healthcheck:          # how compose decides the service is ready

volumes:                  # declares named volumes used above
```

A few that deserve more than one line.

**`ports: "1433:1433"`** is `HOST:CONTAINER`. The left number is on your
machine. If something already owns 1433, change the **left** number only, and
update your connection string. The right number is inside the container and
does not move.

**Volumes — two kinds, and the distinction matters.**

```yaml
volumes:
  - mssqldata:/var/opt/mssql     # NAMED volume: Docker manages it
  - ./src:/app/src               # BIND mount: a host directory
```

A named volume lives in Docker's storage and survives `docker compose down`.
Ours holds the database files, which is why your data is still there tomorrow.
`docker compose down -v` deletes it — that is your "give me a clean database"
button.

A bind mount maps a host directory in, so edits on the host appear instantly
inside. Useful for development; a liability in production, because the
container now depends on the host's filesystem layout.

**Networking.** Compose puts every service on a shared network and runs a DNS
server on it, so **containers reach each other by service name**. That is why a
connection string from another container says `Server=mssql,1433` — `mssql` is
the service name, not a hostname anyone configured.

From your *host*, that name does not resolve. You use `localhost,1433`, which
works because of the `ports:` mapping. Two different addresses for the same
database, depending on where you are asking from. This confuses everyone once.

**`healthcheck`.** Ours runs a real query rather than checking that the process
started, because SQL Server accepts connections well before it can answer. This
matters because another service can then wait properly:

```yaml
depends_on:
  mssql:
    condition: service_healthy    # wait for HEALTHY, not merely STARTED
```

Plain `depends_on: [mssql]` only waits for the container to *start*, which is
almost never what you want.

**Why the SA password is committed.** It protects a container bound to your own
machine, created from that same file. Anyone who can read the file could
already start an identical container. Contrast with `Jwt:SigningKey`, which
authorises real actions and lives in user-secrets. The question is never "does
it look like a password?" but **what does this protect, and who can reach it?**

### The commands

```bash
docker compose up -d        # start everything, detached
docker compose ps           # status and health
docker compose logs -f mssql
docker compose down         # stop, KEEP data
docker compose down -v      # stop and DELETE volumes
```

---

## Part 7b — How containers find each other, and how to isolate them

### The network and its DNS

`docker compose up` creates a private network and puts every service on it:

```
network: knowledge-market_default

   web    172.18.0.4
   api    172.18.0.3
   mssql  172.18.0.2
```

Docker also runs a **DNS server inside every container on that network**, always
at `127.0.0.11`, mapping **service names** to current IPs. The names come
straight from the compose file: write `api:` as a service and `api` becomes a
hostname.

You have already been using this without noticing. The connection string says
`Server=mssql,1433` — `mssql` is not a hostname anyone configured, it is the
service name, resolved by Docker's DNS.

From your **host**, those names do not resolve. You reach a container only
through a published port, as `localhost`. Two different addresses for the same
database depending on where you are asking from.

### Container IPs are not stable — and that is the whole point

```
docker compose up -d                        api = 172.18.0.3
docker compose up -d --force-recreate api   api = 172.18.0.5
```

Docker updates DNS immediately. **The name is stable; the IP is not.** Anything
that caches an IP eventually points at a container that no longer exists.

This is exactly why `nginx.conf` holds the upstream in a variable:

```nginx
# literal — nginx resolves ONCE at config load and caches for the process life
proxy_pass http://api:8080;
   → nginx refuses to start if api is not up:  "host not found in upstream"
   → api restarts with a new IP → every request 502s until nginx restarts

# variable + resolver — DNS is consulted at request time, cached for 10s
resolver 127.0.0.11 valid=10s ipv6=off;
set $api_upstream "api:8080";
proxy_pass http://$api_upstream;
```

The second failure mode is the dangerous one: the API is healthy, and the bug
lives in a container nobody is looking at. In Kubernetes, where pods are
rescheduled constantly, it is a classic outage.

There is also an availability argument. nginx serves the SPA from its own disk
and does not need the API to do it. With the literal form, an API outage takes
the whole site down because nginx will not boot. With the resolver, the site
loads and only `/api` calls fail — users see your UI with an error instead of a
connection refused. **Keep failure domains separate.**

What the variable costs you: no `upstream {}` block, so no load balancing across
replicas, no active health checks, no connection keepalive. With one API
container there is nothing to balance, so it is the better trade.

### Blocking access from outside: publish nothing

```yaml
web:
  ports: ["8080:8080"]   # reachable from your machine
api:
  # no ports key         # NOT reachable from outside. At all.
mssql:
  # no ports key         # same
```

`ports:` is the only thing that opens a route from your host into the container
network. Without it there is no path — not curl, not a browser, nothing on your
LAN. It is not a firewall rule that could be misconfigured; the mapping does not
exist. (`expose:` is documentation only and publishes nothing.)

### Restricting container to container: several networks

By default compose puts everything on **one flat network where everything can
reach everything.** `web` has no business talking to the database.

```yaml
networks:
  edge:
  data:

services:
  web:
    networks: [edge]
    ports: ["8080:8080"]
  api:
    networks: [edge, data]     # on both — it is the bridge
  mssql:
    networks: [data]
```

```
     edge                data
web ◄────► api ◄────────► mssql
web ✗ mssql   — no shared network
```

The classic three tiers: public, application, data. Each service reaches only
its neighbour.

**The test that proves it:** from inside `web`, `nslookup mssql` fails. Docker's
DNS only answers for services sharing a network with you, so the database is not
merely firewalled — as far as `web` is concerned it does not exist.

### The same idea in Kubernetes

Every pod can reach every pod by default. `NetworkPolicy` narrows it:

```yaml
kind: NetworkPolicy
spec:
  podSelector:
    matchLabels: { app: mssql }
  ingress:
    - from:
        - podSelector:
            matchLabels: { app: api }
      ports:
        - port: 1433
```

Selection is by **label**, not IP, because pod IPs change constantly.

**The gotcha:** NetworkPolicy is enforced by the CNI plugin. If the cluster's CNI
does not support it, the policy is **silently ignored** — no error, and
`kubectl get networkpolicy` happily shows it doing nothing. On AKS that means
Azure CNI or Calico. Always verify that a blocked connection actually fails.

### The principle

> **Network isolation is a layer, not the answer.**

"It is on the internal network so it is safe" is the assumption behind a great
many breaches that started small. Concretely here:

- the API is unreachable from outside, **and**
- SQL Server still requires credentials, **and**
- the API still requires a valid auth cookie

Each layer assumes the one outside it has already failed. That is why the CSRF
token stays even after `SameSite=Lax` arrives.

## Part 8 — Where the frontend fits

### Your frontend is three files

```
dist/index.html                 1.9 KB
dist/assets/index-<hash>.js      497 KB
dist/assets/index-<hash>.css      41 KB
```

That is the whole thing. No process, no server program. `index.html` is an
empty `<div id="root">`; the JavaScript draws the page in the browser.

"Serving" it means one thing: something answers HTTP requests by reading those
files off disk and sending the bytes. Any web server can. **ASP.NET Core can**,
and yours is already configured to — see `UseDefaultFiles`, `UseStaticFiles`
and `MapFallbackToFile` in `Program.cs`.

### So why does a Node stage exist?

Because those three files **do not exist yet**. Something has to compile
30-plus `.tsx` files into them, and the compiler is written in JavaScript.

**Node here is a build tool, exactly like the .NET SDK:**

| | Backend | Frontend |
|---|---|---|
| Source | `.cs` | `.tsx` |
| Compiler | .NET SDK, ~850 MB | Node + Vite, ~400 MB |
| Output | `Api.dll` | `index.html` + `.js` + `.css` |
| In the final image? | **no** | **no** |

You already accepted that the .NET SDK belongs in a throwaway build stage. The
Node stage is the same idea for the other language. **Neither ships.**

### Where else could that compilation happen?

| Option | Problem |
|---|---|
| On your laptop, commit `dist/` | Build output in git, a 500 KB binary diff per commit, and the bundle depends on *your* Node version |
| In CI, before `docker build` | The image is no longer self-contained; `docker build` on a fresh clone fails |
| **Inside the Docker build** | Anyone with the repo and Docker reproduces the exact image, with nothing external required |

The third is what "reproducible build" means, and it is the reason to
containerize at all.

---

## Part 9 — Configuration

Nothing environment-specific belongs in an image. Bake in the environment and
you need one image per environment, which means the thing you tested in staging
is not the thing you shipped.

**Build once, promote the same artifact.** The image is environment-agnostic;
values arrive at run time:

```bash
docker run \
  -e ASPNETCORE_ENVIRONMENT=Staging \
  -e ConnectionStrings__Default="Server=…" \
  -e Jwt__SigningKey="…" \
  knowledge-market-api
```

The double underscore is .NET's nesting convention: `Jwt__SigningKey` binds to
`Jwt:SigningKey`, because `:` is not legal in an environment variable name on
most shells.

With `ASPNETCORE_ENVIRONMENT` unset, .NET defaults to **Production** — the
correct default for an image, because Production is the locked-down path.
`ProductionConfigValidator` then refuses to start on missing or placeholder
configuration, so a misconfigured deploy dies in two seconds instead of running
insecurely.

**The frontend has a harder version of this problem.** Vite does not read
`VITE_*` values at run time — it performs a literal text substitution at
*build* time and bakes them into the bundle. A bundle built with a dev Stripe
key can only ever be a dev bundle. The fix is to stop baking them in: serve
them from an API endpoint the SPA calls on boot. That keeps one bundle valid in
all four environments, and keeps the content-hashed assets immutable and
infinitely cacheable.

---

## Part 10 — The plan

The architecture we settled on is **two images behind one origin**: nginx serves
the SPA and forwards `/api/*` to the API container. Not the API serving the SPA
from `wwwroot` — that was the earlier plan, changed once running it locally made
cost irrelevant. See [deployment-roadmap.md](../deployment-roadmap.md).

| # | Branch | What | State |
|---|---|---|---|
| 20 | `feature/vite-dev-proxy` | Vite forwards `/api` to :5116; `apiClient` uses relative URLs | open |
| 21 | `feature/containerize-frontend` | frontend Dockerfile + `nginx.conf` | open |
| 22 | `feature/compose-full-stack` | compose wires web + api + mssql, ports closed on the last two | next |
| 23 | `feature/runtime-config-endpoint` | `GET /api/config` so the bundle stops being environment-specific | |
| 24 | `fix/same-origin-cookies` | `SameSite=Lax`, delete the CORS policy | |
| — | CI builds both images on every PR | so they cannot rot the way the API one did between #10 and #16 | |

---

## Part 11 — Two bugs this build actually surfaced

Both were found by building and running the thing, not by reading it. Worth
recording because they are representative.

### Bug 1 — the bundle had the API's address compiled into it

Building the frontend image produced a bundle containing `http://localhost:5116`
as a literal string. In a deployed browser, `localhost` is the **user's own
machine**, so every API call would fail with connection refused.

Cause: `apiClient.ts` read `import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5116"`.
The image build correctly has no `.env.local`, so the fallback won.

Fix: `const API_BASE_URL = ""`. Relative URLs resolve against whichever origin
served the page, so the bundle stops caring where it is deployed.

The check that caught it, and the habit worth keeping:

```bash
docker run --rm <image> sh -c 'grep -c "localhost:5116" /usr/share/nginx/html/assets/*.js'
```

**When a build-time substitution matters, grep the output for it.** You cannot
reason about what a bundler baked in; you can look.

### Bug 2 — nginx refused to start

```
[emerg] host not found in upstream "api" in /etc/nginx/conf.d/default.conf:51
```

Cause and fix are in Part 7b. The general shape is worth naming: **a name
resolved once at startup is a name that will eventually be wrong.**

### The lesson under both

Neither would have been caught by reading the file, by the compiler, or by any
test in the suite. Both took under a minute to find by building the image and
running it.

A Dockerfile that nothing executes rots silently — which is exactly how
`src/Api/Dockerfile` ended up referencing four deleted projects between PRs #10
and #16. **The fix is to run it in CI**, so it is exercised on every change.

## Command reference

```bash
# build
docker build -f src/Api/Dockerfile -t knowledge-market-api .
docker build … --target build          # stop after one stage
docker build … --no-cache              # ignore the layer cache

# inspect
docker images
docker history <image>                 # every layer and its size
docker run --rm -it <image> sh         # shell inside
docker inspect <image>

# run
docker run -d --name km-api -p 8081:8080 -e KEY=value <image>
docker ps
docker logs -f km-api
docker exec km-api id                  # run a command in a live container
docker rm -f km-api

# compose
docker compose up -d
docker compose ps
docker compose down            # keep data
docker compose down -v         # delete data

# cleanup
docker builder prune -f        # build cache
docker image prune -f          # dangling images
docker container prune -f      # stopped containers
# never `docker system prune --volumes` unless you mean to delete your database
```

---

## Questions

1. What is the difference between an image and a container, and where does each
   live?
2. You changed one line of C# and the build re-downloaded every NuGet package.
   Which instruction is in the wrong place, and why does that cause it?
3. Why must `.dockerignore` exclude `obj/` and `node_modules/`? Give the
   failure, not just "size".
4. You committed a `.env`, then added `RUN rm .env`. Is the secret gone from the
   image? Explain in terms of layers.
5. Your image is 1.2 GB. What is the most likely cause and what is the fix?
6. Why is `ENTRYPOINT ["dotnet", "Api.dll"]` different from
   `ENTRYPOINT dotnet Api.dll`, and what breaks?
7. Why is `EXPOSE 8080` not enough to reach the app from your browser?
8. Your app runs as a non-root user and file uploads fail with
   `UnauthorizedAccessException`. Why, and what are two fixes?
9. In `docker-compose.yml`, why does another container use `Server=mssql,1433`
   while your host uses `Server=localhost,1433`?
10. Why is the SQL Server password safe to commit but `Jwt:SigningKey` is not?
11. Why does a Node stage exist in a Dockerfile that ships no Node?
12. What does `--target` do, and why is it not a way to ship a second container?
13. How does the nginx container find the API container? What does it look up,
    and what would break if it cached the answer?
14. `web`, `api` and `mssql` are on one network. How do you stop `web` reaching
    `mssql`, and how would you prove it worked?
15. Why does the API container publish no port, and what does that stop that a
    firewall rule would not?
16. A bundle was built with `localhost:5116` compiled into it. Why is that
    catastrophic in production, and what one-line change fixes it?
17. In Kubernetes you apply a NetworkPolicy and it appears to do nothing. What
    is the most likely reason?
