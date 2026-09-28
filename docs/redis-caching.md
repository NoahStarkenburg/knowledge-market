# Redis caching

This service uses Redis as a distributed read cache in front of SQL Server for two hot read paths.
The goal is to take the platform's most-repeated reads off the primary database while keeping the
data correct. Redis is **optional**: if `Redis:ConnectionString` is empty the app wires a no-op
cache and behaves exactly as before.

## What is cached, and why those two

Caching only pays off for reads that are **hot** (requested often), **shared** (the same answer for
many callers, so one cached copy serves them all), and **cheap to keep correct** (either they rarely
change, or the write points that change them are few and known). Two reads fit that profile, and
each demonstrates a different cache-freshness strategy.

| Read | Key | TTL | Freshness strategy | Why |
|---|---|---|---|---|
| Course detail (`GET /api/courses/{id}`) | `course:v1:{id}` | 5 min | **Explicit invalidation** on every write | Hit on every course page view; identical for all viewers. An owner who edits a course must see the change immediately, so we evict the key on write and let the TTL act only as a backstop. |
| Catalog stats (`GET /api/catalog/stats`) | `catalog:stats:v1` | 60 s | **TTL only** (no invalidation) | An anonymous landing-page aggregate (a plpgsql function over the courses + users tables) — the single most-repeated, most-shared read. A newly published course showing up in the count a minute late is fine, so a short TTL is simpler and cheaper than invalidating on every platform-wide publish/delete. |

These are the two canonical strategies for keeping a cache fresh: **invalidate on write** when the
data must be correct the instant it changes, and **let a short TTL expire** when a little staleness
is acceptable and the write points are too numerous to chase.

Deliberately **not** cached: per-user lists (`/courses` includes the caller's own drafts — low reuse),
search (arbitrary `q`/tags/price/sort permutations — low hit rate, and results should feel live), and
anything gated by per-user access. Caching those would trade a large invalidation/​correctness burden
for a small hit rate.

## How it is built

```
Application.Abstractions.ICacheStore     <- the port (Get / Set / Remove + GetOrSetAsync helper)
        |
        +-- Api.Caching.RedisCacheStore  <- adapter over IDistributedCache (StackExchange.Redis), JSON
        +-- Api.Caching.NullCacheStore   <- no-op fallback when Redis is not configured
```

- **Cache-aside** (a.k.a. lazy loading): the service checks Redis first; on a miss it loads from
  the database, stores the result, and returns it. `CacheStoreExtensions.GetOrSetAsync` wraps that
  handshake for the course-detail read; the catalog-stats read spells it out inline.
- **Invalidation lives at the write site.** `CourseService` evicts `course:v1:{id}` after update,
  publish, and delete; `UploadService` evicts it after a thumbnail or intro-video change (both edit
  fields that live on the cached DTO). All writers share one key builder, `Application.Catalog.CacheKeys`,
  so a producer and its invalidators can never drift.
- **Graceful degradation.** No Redis configured -> `NullCacheStore` -> every read falls straight
  through to the database. The app builds and boots identically without Redis.
- **Resilience.** `RedisCacheStore` wraps every call: a Redis outage becomes a cache *miss* on reads
  and a no-op on writes, never a failed request. A cache is an optimization; losing it should make
  the app slower, not broken.
- **Stampede protection (single-flight).** The catalog-stats reload is wrapped in
  `Application.Common.SingleFlight`. When the hot key expires, a burst of simultaneous misses is
  *coalesced*: one request runs the aggregate and populates the cache while the rest await that same
  result, instead of every misser launching a duplicate query. Coalescing is per process (an
  in-memory `ConcurrentDictionary<string, Lazy<Task<T>>>`), so with N API instances you get at most
  N rebuilds, not N x requests. The leader re-checks the cache after entering the flight
  (double-checked locking) so a late arrival returns without a DB hit. Verified live: 50 concurrent
  requests at a cold key produced exactly **one** `HMSET` (one database query).

## Seeing it work

```bash
docker compose --profile full up -d --build        # the API uses the km-redis container

# Cache-aside: first request is a miss (read + write + TTL), second is a pure hit (read only)
docker exec km-redis redis-cli MONITOR
#   request 1 (cold): HMGET ... ; HMSET ... ; EXPIRE km:course:v1:<id> 300
#   request 2 (warm): HMGET ...            <- no write, database not touched

docker exec km-redis redis-cli TTL   km:course:v1:<id>     # -> 300
docker exec km-redis redis-cli HGET  km:course:v1:<id> data # -> the cached CourseView JSON

# Invalidation: editing the course evicts the key
#   PATCH /api/courses/<id>  ->  MONITOR shows: UNLINK km:course:v1:<id>
docker exec km-redis redis-cli EXISTS km:course:v1:<id>    # -> 0, next read repopulates

# Stampede protection: 50 concurrent requests at a cold stats key -> ONE rebuild
docker exec km-redis redis-cli DEL km:catalog:stats:v1
seq 50 | xargs -P 50 -I{} curl -s -o /dev/null http://localhost:8080/api/catalog/stats
#   MONITOR shows a single HMSET km:catalog:stats:v1 (one database aggregate), ~51 HMGET
```

> The .NET distributed-cache provider stores each entry as a Redis **hash** (`data` + `absexp` +
> `sldexp` fields), which is why a plain `GET` returns `WRONGTYPE` — read the payload with
> `HGET <key> data`. Keys are prefixed with `km:` (the configured `InstanceName`).

## In Azure: Azure Managed Redis with Entra ID

Locally the API connects to a plain Redis container (`Redis__ConnectionString=redis:6379`). In Azure
it sets `Redis__Host=<name>.<region>.redis.azure.net:10000` instead, and there is **no password
anywhere**:

1. `RedisConnectionFactory` asks Entra ID for a token for the container app's managed identity
   (`DefaultAzureCredential`; `AZURE_CLIENT_ID` picks the user-assigned identity).
2. `Microsoft.Azure.StackExchangeRedis` connects over TLS, sends the identity's object id as the
   Redis user name and the token as the password, and re-authenticates before the token expires.
3. Redis checks that identity against an access policy assignment on the cache, created by
   Terraform: the Redis counterpart of an RBAC role assignment.

Access keys stay disabled on the cache, and `ProductionConfigValidator` refuses a Redis connection
string that carries a password. One `IConnectionMultiplexer` is shared by the cache and the `redis`
health check, which is how StackExchange.Redis is meant to be used: one long-lived connection per
process.

## Trade-offs

- **Staleness vs. freshness.** Any cache serves data that was true at write time. Invalidation makes
  the course detail effectively fresh (bounded only by a missed-eviction backstop); the TTL means the
  catalog stat can be up to 60 s old. That is a conscious choice per read, not an accident.
- **Invalidation is the hard part.** Every field on the cached DTO creates an obligation: whatever
  can change it must evict the key. Thumbnail/intro-video uploads change the DTO from a *different*
  service, which is exactly the kind of write path that gets forgotten — hence the shared `CacheKeys`
  and eviction at each write site. The failure mode of a missed eviction is bounded by the TTL.
- **Invalidation can silently fail.** If Redis is down during a write, `RemoveAsync` swallows the
  error so the write still succeeds — but the stale entry survives until its TTL. That is the reason
  an invalidation-backed key still carries a TTL at all.
- **Is a PK lookup even worth caching?** Course detail is an indexed single-row read that SQL Server
  serves in well under a millisecond, so the per-request latency win is small. The real payoff is
  **load shedding**: the most-viewed pages stop consuming a DB connection and CPU on every hit,
  leaving the database headroom for writes and heavier queries. That benefit scales with traffic.
- **Negative caching, on purpose omitted.** A `null` (course not found) is never stored, so a missing
  id keeps hitting the DB. Caching misses would blunt a scraping/enumeration load but risks masking a
  just-created row; not worth it here.
- **Cache stampede — handled for catalog stats, not for course detail.** When a hot key expires,
  concurrent misses can all hit the DB at once (a "thundering herd"). The catalog-stats reload uses
  single-flight to collapse that to one rebuild (see above); course detail does not, because its load
  spreads across per-id keys rather than concentrating on one global key, so no single expiry stampedes.
  Single-flight has its own caveats: coalescing is per instance (not fleet-wide — that needs a
  distributed Redis lock), and waiters share the leader's execution, so a cancelled leader cancels the
  followers (fine for a fast aggregate, riskier for a long reload).
- **Serialization cost + shape coupling.** Values are JSON. That is debuggable and portable, but a
  change to `CourseDto`'s shape can leave incompatible bytes in Redis — which is what the `v1` segment
  in every key is for: bump it and the whole family is abandoned rather than mis-deserialized.

## Teaching note

A cache is not a database — it is a **bet that the recent past predicts the near future**, and every
design decision is about how you handle being wrong. Cache-aside keeps the database as the single
source of truth and treats Redis as a disposable copy: read Redis, and only on a miss pay for the
real query and remember the answer. That inverts the usual worry. You are no longer asking "how do I
make this fast," you are asking "how wrong am I willing to be, and for how long?" The course detail
answers *not at all if I can help it* — so it evicts the key the moment an edit lands and keeps a TTL
only to survive the case where that eviction never reached Redis. The catalog stat answers *a minute
is fine* — so it skips invalidation entirely and just lets a short TTL expire, trading a sliver of
staleness for a lot less coupling. The engineering that makes this trustworthy is unglamorous and
lives at the edges: keep one source of truth for the key so a producer and its invalidators can't
drift; put eviction at the write site, including the write paths in other services that quietly touch
the same data; and make the whole thing degrade to "just slower" when Redis disappears, because a
cache that can take down your app is worse than no cache at all. Get those three right and caching
stops being a performance hack and becomes what it should be: a boundary you can reason about, where
you have decided — read by read — exactly how much truth you are willing to trade for speed.
