# Deployment roadmap

> Written before the first deployment, as the plan. The app is now live on Azure
> (Front Door, Container Apps, Azure SQL, all in Terraform under `infra/`); see
> the README for what is running today.

What this application is deployed as, from a laptop to AKS, and why each step
is a re-expression of the same architecture rather than a rewrite.

## The short answer

Three things, always:

| Piece | What it is |
|---|---|
| **Static SPA** | three files, served by an edge and cached aggressively |
| **Containerized API** | one .NET image, environment injected at run time |
| **Managed SQL** | never inside the application's own runtime |

...behind **one origin**, with `/api/*` routed to the API and everything else
served as static files.

What changes between stages is only *who plays the edge* and *who runs the
container*. The application does not change.

---

## The thesis

> **One shape. Four hosts. The shape is the design; the host is a deployment
> detail.**

```
                        one origin
                            │
                  ┌─────────▼──────────┐
                  │       EDGE         │   TLS · routing · caching · WAF
                  │  /api/*  →  API    │
                  │  /*      →  static │
                  └────┬──────────┬────┘
                       │          │
              ┌────────▼───┐   ┌──▼──────────┐
              │  API       │   │  static SPA │
              │ (container)│   │  (3 files)  │
              └────────┬───┘   └─────────────┘
                       │
                 ┌─────▼─────┐
                 │  SQL      │
                 └───────────┘
```

Who fills each box:

| Box | Stage 0 — local | Stage 1 — cloud | Stage 2 — edge | Stage 3 — AKS |
|---|---|---|---|---|
| **Edge** | nginx container | Container Apps ingress + nginx | Front Door / SWA | Ingress Controller |
| **API** | container | Container App | Container App | Deployment + Service |
| **Static** | volume in nginx | in the nginx image | Blob / SWA | Ingress → static, or Blob |
| **SQL** | container | Azure SQL | Azure SQL | Azure SQL |

Note the last row. **SQL is never run by us after Stage 0.** More on that below.

---

## Stage 0 — local, production-shaped (where we are)

```
docker compose up
                     localhost:8080
                           │
             ┌─────────────▼──────────────┐
             │  proxy  (nginx)            │  ← the ONLY published port
             │    /api/*  → proxy_pass    │
             │    /*      → serve dist/   │
             └──────┬─────────────────────┘
                    │   internal network only
          ┌─────────▼────┐      ┌──────────────┐
          │  api (.NET)  │─────▶│  mssql       │
          │  no host port│      │  no host port│
          └──────────────┘      └──────────────┘
```

**The property that matters:** `api` and `mssql` publish no ports. They are
reachable only from inside the compose network. `proxy` is the entire public
surface.

That is least-exposure, and it is an honest model of production, where the API
sits in a private subnet behind an edge. It also *proves* the single-origin
claim — if a browser can only reach port 8080, then `/api/courses` and
`/index.html` are unarguably the same origin.

**What gets built here:**

| Artifact | Contents |
|---|---|
| `knowledge-market-api` | .NET 9 runtime + `Api.dll`. No SPA, no compiler. |
| `knowledge-market-web` | nginx + `dist/`. Node used to build, then discarded. |

Cost: **$0**.

---

## Stage 1 — first cloud deploy

Goal: **a live URL someone can click.** One day of work, minimal spend.

### Option 1a — Azure Container Apps (recommended)

Container Apps supports **internal ingress**, which maps the compose shape
almost exactly:

```
proxy   Container App, EXTERNAL ingress   → public FQDN, free TLS certificate
api     Container App, INTERNAL ingress   → reachable only inside the environment
sql     Azure SQL (serverless)            → outside the container environment
```

nginx `proxy_pass`es to the API over the environment's internal DNS, exactly as
it does over the compose network. **The nginx config barely changes** — the
upstream hostname does, and nothing else.

- Consumption pricing, **scales to zero** when idle
- Free TLS and a free `*.azurecontainerapps.io` hostname
- The built-in ingress handles TLS termination and load balancing

### Option 1b — one VM running the compose file

Copy `docker-compose.yml` to a small VM, `docker compose up -d`, point DNS at
it, add Caddy or certbot for TLS.

Unglamorous, and **a great many real production apps run exactly this way.**
Cheapest possible path, and the deploy is literally the thing you already
tested locally.

### Option 1c — Static Web Apps + Container Apps

SPA on SWA (free tier, global CDN included), API on Container Apps, with SWA's
**linked backend** proxying `/api/*` so the origin stays single.

The trap to know: on default hostnames (`*.azurestaticapps.net` vs
`*.azurecontainerapps.io`) you are on different registrable domains — so
cross-*site*, which forces `SameSite=None` and hands back the third-party-cookie
fragility this architecture exists to avoid. Custom subdomains of one domain, or
a linked backend, fixes it. Linked backends require the Standard tier.

### Recommendation

**1a.** It maps the local shape one-to-one, scales to zero so idle cost is
near nothing, and gives free TLS. 1b is the fallback if a single artifact is
simpler on the day.

---

## Stage 2 — a managed edge

Replace nginx-as-edge with a real one.

```
knowledgemarket.com  →  Azure Front Door
     /api/*   → Container Apps        cache: bypass
     /assets/*→ Blob static website   cache: 1 year, immutable
     /*       → Blob static website   cache: no-cache on index.html
```

**What this buys:** ~190 global PoPs, WAF, edge rate limiting, DDoS absorption,
and static served from near the user instead of from your container.

**What it costs:** roughly $35/month base plus traffic — which is why this is
worth doing as a *measured exercise* rather than leaving it running. Stand it
up, capture before/after first-paint latency and cache-hit ratio, document it,
tear it down. The measurements are the portfolio artifact; the standing bill is
not.

**What changes in the app: nothing.** The API image is identical. The routing
rules move from `nginx.conf` into Front Door's rules engine. Because the origin
never changed, auth and CSRF are untouched.

**The one rule not to get wrong:** `/api/*` must bypass the cache entirely. A
cached authenticated response is one user seeing another user's data.

---

## Stage 3 — AKS

This is the learning target, so here is the mapping in full. **Almost
everything built in Stage 0 carries over as a different file format.**

### Compose → Kubernetes

| Compose | Kubernetes | Note |
|---|---|---|
| a `service` | `Deployment` + `Service` | Deployment manages pods; Service gives a stable name |
| the nginx `proxy` container | `Ingress` + an Ingress Controller | **you delete your proxy container** — the controller is the cluster's nginx |
| `ports: "8080:8080"` | `Service` + `Ingress` | Ingress is the only public entry |
| `environment:` non-secret | `ConfigMap` | |
| `environment:` secret | `Secret`, ideally Key Vault via the CSI driver | never a literal in a manifest |
| `depends_on: service_healthy` | `readinessProbe` (+ `initContainers`) | k8s has no ordering primitive; readiness *is* the mechanism |
| `HEALTHCHECK` in the Dockerfile | `livenessProbe` / `readinessProbe` | **delete the Dockerfile instruction** — the scheduler owns this |
| named volume | `PersistentVolumeClaim` | we avoid needing one |
| compose network | cluster networking + `NetworkPolicy` | NetworkPolicy is how you re-create "no published ports" |
| `docker compose up` | `kubectl apply` / `helm upgrade` | |
| implicit restart | the Deployment controller | |
| `deploy: replicas` | `replicas` + `HorizontalPodAutoscaler` | |
| the image | **the same image**, from ACR | unchanged |

**The Dockerfiles do not change.** That is the payoff for building them
properly now.

### What AKS adds that has no compose equivalent

| | Why it matters |
|---|---|
| `Namespace` per environment | dev / qa / staging / prod in one cluster, isolated |
| resource `requests` / `limits` | the scheduler needs them to place pods; without limits one pod starves the node |
| `HorizontalPodAutoscaler` | scale on CPU or custom metrics |
| `PodDisruptionBudget` | keeps N pods up during node drains and upgrades |
| `cert-manager` | automatic Let's Encrypt certificates |
| Key Vault CSI driver | secrets mounted from Key Vault, never in git or a manifest |
| Helm or Kustomize | one templated manifest set, four environments |
| Argo CD or Flux | GitOps — the cluster reconciles itself to what is in git |
| Prometheus + Grafana | the observability work from Phase 8, cluster-wide |

### Cost and how to approach it

The AKS control plane is free on the Free tier; **nodes are not.** A single
small node runs roughly $30/month. So AKS gets the same treatment as Front
Door: **spin it up, do the work, capture the artifacts, tear it down.** A
Helm chart and a documented migration in the repo is the portfolio value.
A cluster idling at $30/month is not.

### The honest interview framing

> "It runs as containers behind a single origin. Locally that's Compose with
> nginx as the edge; in Azure it's Container Apps with the platform ingress. I
> wrote the Helm chart and ran it on AKS to understand the mapping — Ingress
> replaces my nginx container, probes replace the Dockerfile `HEALTHCHECK`,
> ConfigMap and Secret replace the compose environment block, and the image is
> byte-identical. I don't run the cluster continuously because a single-service
> app doesn't justify one, but the migration path is real and I've done it."

That is stronger than running Kubernetes you can't justify.

---

## What we deliberately do not do

| Not doing | Why |
|---|---|
| **SQL Server inside Kubernetes** | Stateful workloads in k8s mean StatefulSets, storage classes, backup and failover you now own. Managed Azure SQL gives you backups, PITR and patching. Running your own database is a decision that needs a reason. |
| **Microservices** | The bounded contexts still share six cross-schema joins. Splitting now buys distributed transactions and no benefit. Breaking those joins is the prerequisite, and it is tracked separately. |
| **A service mesh** | Istio/Linkerd solve mTLS, traffic shifting and observability *between many services*. There are two. |
| **Multi-region** | Nothing here needs it, and it forces data-residency and replication decisions with no driver. |
| **A second image just to serve static files in the cloud** | A CDN is not a container. Once static is on Blob or SWA, the web image is a local-development artifact only. |

Each of these is a thing to be able to *discuss*, not a thing to build.

---

## Decision log

**Single origin, everywhere.** Auth is a JWT in an HttpOnly cookie plus a CSRF
double-submit token. Same origin means `SameSite=Lax`, so the browser blocks
cross-site POSTs itself, and there is no CORS configuration to keep correct
across four environments. Cross-origin on a different registrable domain would
force `SameSite=None` — the third-party-cookie setting Safari already blocks.
See [learning/05a-serving-a-spa.md](learning/05a-serving-a-spa.md).

**Configuration is injected at run time, never baked in.** One image is built
once and promoted through dev, QA, staging and prod. `ASPNETCORE_ENVIRONMENT`
is deliberately unset in the Dockerfile, so an image defaults to Production and
`ProductionConfigValidator` refuses to start on missing or placeholder values.

**The SPA's config should come from `GET /api/config`, not from build-time values.**
Values compiled into the bundle at build time mean one bundle per environment.
Fetching them at runtime keeps the content-hashed bundle immutable and cacheable
for a year. (Today the Stripe publishable key is still a build argument; this
endpoint is the planned fix.)

**`index.html` is never cached; `/assets/*` is cached for a year.**
`index.html` is the manifest naming the hashed files. Cache it and a deploy
leaves users pointing at assets that no longer exist.

**Two images, not one.** The API image is a pure API; the web image is nginx
plus `dist/`. This keeps their build caches independent and mirrors the cloud
shape, where static files leave the container entirely.

**Nothing but the edge is publicly reachable.** No published ports on the API or
the database at any stage. In compose that is the absence of a `ports:` key; in
Container Apps it is internal ingress; in Kubernetes it is `NetworkPolicy`.

---

## Cost by stage

| Stage | Monthly | Notes |
|---|---|---|
| 0 — local | **$0** | |
| 1a — Container Apps + Azure SQL | ~$5-20 | scales to zero when idle |
| 1b — one VM | ~$5-15 | |
| 2 — + Front Door | +$35 base | run as a measured exercise, then remove |
| 3 — AKS | +$30/node | same: build, measure, document, tear down |

---

## Sequence

```
Phase 5   ┌ /api/config runtime config endpoint
          ├ frontend image: Node build → nginx runtime
          ├ compose: proxy + api + mssql, ports closed
          └ SameSite=Lax, CORS deleted, dev-server proxy
Phase 6b  backend code quality — .editorconfig, warnings, dotnet format in CI
Phase 7   testing depth
Phase 8   observability — OpenTelemetry, structured logs, dashboards
Phase 9   Stage 1 deploy: a live URL
Phase 9b  Stage 2 edge, measured and documented
Phase 10  Stage 3 AKS: Helm chart, migration write-up
```
