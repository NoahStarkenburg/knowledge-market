# Load testing

k6 scripts that drive the site the way the Angular app does, plus a local Grafana stack
that shows what happens inside while they run. Commands are for PowerShell, one per line,
run from the repository root.

## What each script is for

| Script | Test | Question it answers |
|---|---|---|
| `smoke.js` | smoke | Does every page and check work at all? Run it first, every time. |
| `average.js` | average load | Do the objectives hold on a normal busy hour (1,000 learners online)? |
| `stress.js` | stress | How many page views a second before the objectives break, and what breaks? |
| `spike.js` | spike | What happens during a sudden surge, and how fast does it recover? |
| `steady.js` | fixed rate | Building block for experiments and soak tests. |
| `rate-limits.js` | rate limits | Are the API's limits working through nginx? Here a 429 is the expected answer. |
| `burst.js` | one burst | Is a rate limit on or off right now? Tells a Front Door 429 from an API 429. |
| `prod.js` | production | Baseline, steady and stress runs against the live site. Read-only. |
| `create-learners.js`, `prod-accounts.js` | setup | Create the accounts the tests sign in with. |

The objectives (SLOs) live in `lib/config.js` with the reasoning for each number. Every
script fails (non-zero exit) when an objective is missed.

## Local stack

Three compose files, layered:

- `docker-compose.yml`: the app (SQL Server, Azurite, Redis, and with `--profile full` the API and nginx).
- `docker-compose.observability.yml`: OpenTelemetry Collector, Tempo, Mimir, Loki and Grafana.
- `docker-compose.loadtest.yml`: Azure's CPU and memory limits, and nginx trusting a Front Door ID so k6 can play Front Door.

Start everything:

```powershell
docker compose -f docker-compose.yml -f docker-compose.observability.yml -f docker-compose.loadtest.yml --profile full up -d --build
```

Seed the bulk data once (20 creators, 200 courses, 100 learners, about 5,000 orders). The
seed endpoint only exists in Development, so a one-off copy of the API runs as Development:

```powershell
docker compose -f docker-compose.yml -f docker-compose.observability.yml -f docker-compose.loadtest.yml --profile seed up -d seed
```

The API checks CSRF on every POST by comparing the `km_csrf` cookie with the `X-CSRF`
header, so the request sends a matching pair:

```powershell
Invoke-RestMethod -Method Post http://localhost:5199/api/dev/bulk-seed -Headers @{ "X-CSRF" = "seed"; "Cookie" = "km_csrf=seed" }
```

It answers "Already seeded." if the data is there. Stop the seed copy afterwards:

```powershell
docker compose -f docker-compose.yml -f docker-compose.observability.yml -f docker-compose.loadtest.yml --profile seed rm -sf seed
```

Register the 1,000 load-test learners once:

```powershell
k6 run loadtest/create-learners.js
```

Grafana is at http://localhost:3000 (user `admin`, password `local-dev-only`, or whatever
you set in `GRAFANA_ADMIN_PASSWORD`). Open the dashboard "KnowledgeMarket - load tests and
SLOs". Alerts are under Alerting.

With the load-test overlay on, nginx answers 403 to anything without the Front Door ID, so
a browser pointed at http://localhost:8080 gets nothing. Browse the app with the plain
stack instead.

## Running tests locally

Send k6's own results to Mimir, so they appear on the dashboard next to the server's:

```powershell
$env:K6_PROMETHEUS_RW_SERVER_URL = "http://localhost:9009/api/v1/push"
```

```powershell
$env:K6_PROMETHEUS_RW_TREND_AS_NATIVE_HISTOGRAM = "true"
```

Then any of:

```powershell
k6 run -o experimental-prometheus-rw --tag testid=smoke loadtest/smoke.js
```

```powershell
k6 run -o experimental-prometheus-rw --tag testid=average loadtest/average.js
```

```powershell
k6 run -o experimental-prometheus-rw --tag testid=stress loadtest/stress.js
```

```powershell
k6 run -o experimental-prometheus-rw --tag testid=spike loadtest/spike.js
```

```powershell
k6 run -o experimental-prometheus-rw --tag testid=soak -e RATE=40 -e DURATION=30m loadtest/steady.js
```

```powershell
k6 run loadtest/rate-limits.js
```

Add `--summary-export loadtest/results/<name>.json` to keep the numbers; `loadtest/results/`
is ignored by git.

## Against the live site

The WAF and the API's rate limiter both stop a single machine long before it finds the
site's capacity. That is the point of them. `prod.js -e TEST=baseline` stays under both and
can run any time. `steady` and `stress` need both lifted for your address only, for the
length of the test, and put back straight after:

1. `terraform plan -out=tfplan -var 'load_test_allowed_ips=["<your IP>/32"]'` plus the usual variables. It must show one change to the WAF policy and nothing else. Apply that plan file.
2. `az containerapp update -n knowledgemarket-api -g knowledgemarket-rg --set-env-vars RateLimiting__Enabled=false`
3. Run the tests.
4. `az containerapp update -n knowledgemarket-api -g knowledgemarket-rg --remove-env-vars RateLimiting__Enabled`, then prove the limit is back with `burst.js` against an `/api` path (expect "429 from the API").
5. Plan and apply without `load_test_allowed_ips`, then prove the WAF limit is back with `burst.js -e TARGET=/ -e COUNT=1200` (expect "429 from Front Door").
6. `terraform plan` shows "No changes". Delete the reader accounts with `prod-accounts.js -e ACTION=delete`. Delete any `tfplan` file, since plan files can contain secrets.

Never commit your address, the reader accounts' password or a plan file.
