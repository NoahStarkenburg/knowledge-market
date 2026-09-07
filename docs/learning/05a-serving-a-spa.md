# Serving a single-page app

Companion to [05-containers.md](05-containers.md). That document is about
container mechanics; this one is about the thing we are containerizing — how a
React SPA actually reaches a browser, and what changes about cookies, CORS and
caching depending on who serves it.

Written for someone who is strong on the backend and has never deployed a
frontend.

---

## 1. What the frontend actually is

`npm run build` produces this, and nothing else:

```
dist/index.html                 1.9 KB
dist/assets/index-<hash>.js      497 KB
dist/assets/index-<hash>.css      41 KB
```

Three files. There is no frontend program and no frontend process. Every page,
every route, all of React and React Router, compiled into one `.js` file.

`index.html` is nearly empty:

```html
<body>
  <div id="root"></div>
</body>
```

The JavaScript runs **in the browser**, reads the URL, and draws the page into
that div. The browser is the frontend runtime.

> **The frontend is just static files.** Everything below follows from that.

## 2. What "serving" means

Something answers HTTP requests by reading those files off disk and sending the
bytes.

```
GET /index.html   →   read the file, send it              static
GET /api/courses  →   run C#, query SQL, build JSON       dynamic
```

Any HTTP server can serve static files — nginx, a CDN, and **ASP.NET Core**.
Handing over a file is the simplest thing a web server does.

**There is no such thing as a "frontend server" for a SPA.** There is only
*something that serves files*, and you choose what.

## 3. The deep-link problem

React Router changes the URL without asking the server. Then the user presses
F5 on `/courses/abc-123` and the browser has no choice but to ask:

```
GET /courses/abc-123

dist/index.html         no
dist/assets/…           no
dist/courses/abc-123    DOES NOT EXIST      → 404
```

That file will never exist. The route is an idea inside your JavaScript.

**The fix: when a request matches no real file, return `index.html` anyway.**
The browser then loads the bundle, React Router reads
`window.location.pathname`, and renders the right page at the right URL.

Every static host has this setting:

| Server | Syntax |
|---|---|
| nginx | `try_files $uri $uri/ /index.html;` |
| ASP.NET Core | `app.MapFallbackToFile("index.html");` |
| Vercel / Netlify | a rewrite rule |
| S3 + CloudFront | error document = `index.html` |

**`try_files` and `MapFallbackToFile` are the same rule.** You already solved
this problem in C#.

## 4. The three lines already in `Program.cs`

```csharp
app.UseDefaultFiles();                    // ~620
app.UseStaticFiles();                     // ~621
app.MapFallbackToFile("index.html");      // ~782
```

- **`UseStaticFiles`** — if the path matches a real file under `wwwroot/`, send
  it and stop. This serves `/assets/index-<hash>.js`.
- **`UseDefaultFiles`** — if the path is a directory, look for `index.html`
  inside it. Makes `GET /` work. Must come *before* `UseStaticFiles`, because it
  works by rewriting the path.
- **`MapFallbackToFile`** — last in the pipeline. Nothing matched, so send
  `index.html`. The deep-link fix.

Ordering does the work: `/api/courses` matches a route and never reaches the
fallback; `/assets/x.js` matches a file; `/courses/abc-123` matches neither and
falls through.

`.gitignore` even documents the intent — *"wwwroot holds the built SPA copied in
from the frontend"*. The API was always meant to serve the SPA. Only the build
step that fills `wwwroot/` is missing.

## 5. Origins and sites — two different rules

```
        scheme  ://  host       :  port
        http    ://  localhost  :  5173
```

**Same-origin** means all three match. **Same-site** means the same registrable
domain (eTLD+1). They are not the same rule and they govern different things:

| Concept | Rule | Governs |
|---|---|---|
| same-**origin** | scheme + host + port identical | **CORS** |
| same-**site** | same registrable domain | **cookies / `SameSite`** |

| Pair | Origin | Site |
|---|---|---|
| `localhost:5173` vs `localhost:5116` | different | same |
| `app.example.com` vs `api.example.com` | different | **same** |
| `app.example.com` vs `evil.com` | different | different |
| `example.com/a` vs `example.com/b` | **same** | same |

Two things to hold onto:

- **Path is not part of the origin.** `example.com/` and `example.com/api/x` are
  the same origin. That is the whole trick behind path-based routing.
- **Subdomains are same-site.** `blog.example.com` is same-site with
  `api.example.com`, so `SameSite` does *not* protect you from a compromised
  subdomain. That is why a CSRF token is still needed.

Today in development you are cross-origin: Vite on `:5173`, the API on `:5116`.
The browser treats them as two unrelated websites.

## 6. Cookies

The server sends a header:

```
Set-Cookie: km_at=eyJhbGci…; HttpOnly; Secure; SameSite=Lax; Path=/
```

The browser stores it and **automatically attaches it to future requests to
that destination**. You never write code to send it.

`HttpOnly` means JavaScript cannot read it — `document.cookie` will not show
it. So an injected script (XSS) still cannot steal the token.

### Why automatic attachment is dangerous

1. You are logged into `knowledgemarket.com`.
2. You visit `evil.com`.
3. It auto-submits a form to `knowledgemarket.com/api/orders`.
4. **The browser attaches your auth cookie**, because it always does.
5. The API sees a valid signed-in request.

That is **CSRF**. The attacker never saw your cookie; they made *your browser*
use it.

### `SameSite` is the browser's built-in defense

| Value | Cookie is attached when… |
|---|---|
| `Strict` | the request comes from your own site only |
| `Lax` | same-site, plus top-level navigations — the modern default |
| `None` | **always**, including from any other site. Requires `Secure`. |

With `Lax`, step 4 above never happens — the browser refuses. **That is CSRF
protection enforced by the browser, before your code runs.**

`None` is required only when the frontend and API are on genuinely *different
sites*. It is also the third-party-cookie setting that Safari's ITP blocks,
Firefox partitions, and Chrome has spent years restricting. Sites relying on it
periodically discover login is broken in Safari.

`src/Api/Authorization/CookieHelpers.cs` currently selects `None` outside
Development, because the SPA is served from a different origin. Single-origin
lets that become `Lax` everywhere.

## 7. The CSRF double-submit token

You still need one, because `SameSite` does not cover same-site attackers
(Part 5) or state-changing GETs, and its semantics have shifted before. OWASP
treats it as a layer, not a complete defense.

The mechanism, as implemented here:

**Create** — `AuthEndpoints.cs`, on login:

```csharp
var csrfBytes = RandomNumberGenerator.GetBytes(32);   // crypto RNG, not Random
var csrf = Base64UrlEncoder.Encode(csrfBytes);
http.Response.Cookies.Append(AuthCookies.CsrfCookie, csrf, …);
```

**Store** — note the deliberate asymmetry in `CookieHelpers.cs`:

```csharp
Auth(…)  => new() { HttpOnly = true,  … }   // km_at, km_rt — JS must NOT read
Csrf(…)  => new() { HttpOnly = false, … }   // km_csrf     — JS MUST read
```

**Send** — `apiClient.ts`:

```typescript
const match = document.cookie.match(/km_csrf=([^;]+)/);
…
"X-CSRF": getCsrfToken(),
```

**Validate** — `Program.cs`, on every unsafe method:

```csharp
!CryptographicOperations.FixedTimeEquals(
    Encoding.UTF8.GetBytes(csrfCookie),
    Encoding.UTF8.GetBytes(csrfHeader))
```

Constant-time, because comparing secrets with `!=` leaks how many leading bytes
matched.

### Why it cannot be forged

```
evil.com POSTs to knowledgemarket.com/api/orders

  km_at cookie     browser attaches automatically      attacker gets this free
  km_csrf cookie   browser attaches automatically      free too
  X-CSRF header    attacker must SET it themselves     and cannot
```

To set the header they must **read** the cookie, and the same-origin policy
means JavaScript on `evil.com` can never read a cookie belonging to your
domain.

> The token is not secret from the *user*. It is secret from *other websites*.

A second defense comes free: a cross-origin request carrying a custom header
triggers a CORS **preflight**, which your policy rejects, so the real request is
never sent.

**Exemptions** (`Program.cs`) — the question is always *what does an attacker
gain by forging this?*

| Endpoint | Exempt | Why |
|---|---|---|
| login, register | yes | no token exists yet |
| webhooks | yes | Stripe cannot send the header; verified by HMAC signature |
| refresh | yes | forging it only rotates the token in the victim's own browser |
| logout | **currently yes** | forging it *does* disrupt the user — should require the token |

## 8. CORS

Separate mechanism, constantly confused with cookies.

**CORS controls whether JavaScript may *read* a cross-origin response.** The
browser blocks it unless the server opts in:

```
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
```

Anything beyond a simple GET triggers a **preflight** `OPTIONS` request first —
two round trips.

That is what the `AddCors` block in `Program.cs` is for, maintaining a list of
allowed origins per environment. **Single-origin needs none of it.**

> CORS is not a firewall. curl, Postman and any script can call your API freely.
> CORS only restrains *browser JavaScript reading responses*. Your auth is what
> protects the server.

## 9. The four deployment shapes

### A — one container, the API serves everything

```
example.com  →  [ .NET container: /api/* + wwwroot ]
```

One origin, because path is not part of the origin.

**Pros:** one artifact, one deploy, no CORS, `SameSite=Lax`, cheapest hosting,
already wired in `Program.cs`.
**Cons:** frontend and backend deploy together; no independent scaling; no edge
caching without adding a layer.
**Use when:** one team, one deploy cadence. Solo projects, internal tools, early
startups. This is the idiomatic .NET shape — Microsoft's own templates did it.

### B — two containers, two subdomains

```
app.example.com  →  [ nginx: static ]
api.example.com  →  [ .NET container ]
```

Different origins (CORS required) but the **same site**, so `SameSite=Lax`
still works.

**Pros:** independent deploy and scale; nginx is better at static; clean team
boundary.
**Cons:** CORS config per environment; two images; two things to monitor.
**Use when:** separate teams or separate release cadences.

### B′ — two containers, one origin, edge does path routing

```
              ┌─ CDN / Front Door / nginx ─┐
example.com   │  /api/* → API container    │
              │  /*     → static files     │
              └────────────────────────────┘
```

A **reverse proxy** accepts a request, forwards it to another server, and
returns that response as its own. The browser only ever sees one origin.

**Pros:** everything B gives, plus single origin — no CORS, `SameSite=Lax`, one
domain, one certificate. Static is edge-cached, API is not. WAF and rate
limiting at the edge.
**Cons:** a third component to configure and debug; costs money.
**Use when:** real traffic, or more than a couple of engineers.

**This is the gold standard.** Applied to a SPA with cookie auth it has a name
interviewers know: the **BFF pattern** — the SPA talks only to something on its
own origin, which holds the tokens.

### C — static host / CDN

```
example.com      →  CDN (Vercel / Static Web Apps / S3+CloudFront)
api.example.com  →  [ .NET container ]
```

**Pros:** fastest static delivery globally, often free, push-to-deploy, frontend
survives an API outage.
**Cons:** two pipelines; CORS. **If the CDN is on a different domain —
`*.vercel.app`, `*.azurestaticapps.net` — you are cross-*site*, so `SameSite=None`
and the third-party-cookie fragility returns.** A custom subdomain removes that.
**Use when:** consumer-facing, global audience.

## 10. The edge

A CDN is a network of datacenters — **PoPs** — near users. Since traffic
already passes through them, vendors added everything that benefits from being
first:

| At the edge | What it does |
|---|---|
| caching | serve static files without touching your origin |
| TLS termination | handshake near the user |
| **path routing** | `/api/*` → container, `/*` → static. This is what gives one origin |
| WAF | block injection, traversal, known-bad payloads |
| rate limiting | drop floods before they cost you anything |
| DDoS absorption | soak volumetric attacks across the network |

### Why edge rate limiting *and* application rate limiting

You already have real application rate limiting (`Program.cs`): 200/min global,
login 10/min per IP, checkout 5/min per user, plus account lockout in
`Domain.Identity/User.cs`. So why add more?

Because each layer catches what the other structurally cannot:

| | **Edge** | **Application** |
|---|---|---|
| Knows | IP, headers, path, geo | **user id, role, business context** |
| Protects | your capacity and your bill | your business rules |
| Stops | volumetric floods, scanners, scrapers | abuse by legitimate signed-in users |
| Cost to enforce | ~zero | your compute |

A 5M req/s flood would be *correctly rejected* by your app — after it accepts
the connection, terminates TLS, parses the request and runs middleware, five
million times a second. You fall over, or your autoscaler succeeds and hands you
the bill. The edge drops it worldwide before a packet reaches Azure.

Conversely, the edge cannot know that these particular requests are one user's
sixth checkout this minute. Only your app knows that.

**And nothing on the client counts.** Debouncing a search box is UX. The
attacker controls the browser — devtools, or curl, or no browser at all. *If a
limit is a control, it must live where the user cannot edit it.*

## 11. Azure

| Service | Shape | Notes |
|---|---|---|
| Container Apps | A | scale-to-zero; best fit for a portfolio container |
| App Service for Containers | A | simple, always warm |
| Static Web Apps | C | purpose-built for SPAs, global CDN included |
| SWA + linked backend | B′ | proxies `/api/*` to your backend — single origin **and** CDN |
| Front Door | B′ | enterprise edge: path routing, WAF, global |
| Azure CDN (classic) | — | being retired; use Front Door |

Verify current tiers and pricing in the portal; they move.

**Suggested path:**

```
now       A, one image → Container Apps            deployed, cheap, done
later     Static Web Apps in front                 CDN + single origin
someday   Front Door, if WAF or multi-region       probably never
```

**Do not start with a CDN.** The bundle is 540 KB and browser-cached after first
load; a CDN saves perhaps 100 ms on a first visit, against a second deploy
target and a cache-invalidation story — before you have users. A live URL beats
a sophisticated unfinished architecture.

Crucially, **A is a strict subset of B′, not a detour.** Same origin, same URL
scheme, same cookie behaviour. Upgrading is a deployment change: point the edge
at the domain, route `/assets/*` to a static origin. No application code
changes, because you never went cross-origin.

## 12. Build-time vs run-time config

Vite does **not** read `VITE_*` at run time. At build time it performs a literal
text substitution and bakes the value into the bundle. A bundle built with a dev
Stripe key can only ever be a dev bundle — which collides with build-once,
promote-everywhere.

| Approach | Verdict |
|---|---|
| One image per environment | Four artifacts; you ship what you did not test. No. |
| Placeholder + `sed` at container start | Works, common with nginx, but you are editing minified JS on boot and it cannot work on a CDN |
| **Runtime config endpoint** | **Do this.** |

```csharp
app.MapGet("/api/config", (IConfiguration cfg) => new {
    stripePublishableKey = cfg["Stripe:PublishableKey"],
}).AllowAnonymous();
```

The SPA fetches it on boot instead of reading `import.meta.env`. Values then come
from the API's own configuration — environment variables, per environment.

This matters more with a CDN, not less. Vite content-hashes the bundle, so
`index-<hash>.js` is **immutable** and cacheable for a year with no invalidation
logic. Baking config in destroys that property.

Note the asymmetry: `index.html` should be `Cache-Control: no-cache` while
`/assets/*` is cached forever — because `index.html` is the manifest pointing at
the hashed filenames. Cache it and users get stale references after a deploy. So
serving `index.html` from the API on every request is normal, not a compromise,
and it is where per-page meta tags can be injected.

## 13. Would SSR change this?

**SSR** generates HTML per request on a server. That breaks the premise this
document rests on:

| | SPA (what you have) | SSR |
|---|---|---|
| Build output | 3 static files | static files **+ a Node server** |
| Needs a running process | **no** | **yes**, per request |
| Can a plain CDN host it | yes | no |
| Can ASP.NET serve it | yes, trivially | no — it is a Node app |

With SSR you genuinely do have a frontend server: its own container, scaling,
health checks. You would also hit the classic bug — the SSR server fetching your
API *from the server* has no browser attached, so it must forward the user's
cookie header manually, and getting it wrong leaks one user's data into
another's page.

### Do you need it?

What actually breaks today: `dist/index.html` carries the **same meta tags on
every page**. Googlebot renders JavaScript, but social scrapers — Slack,
Twitter, LinkedIn, Discord — do not. So every shared course link previews as the
generic site title rather than the course. For a marketplace, that is a real
product problem.

Cheapest fixes first:

1. **Inject per-course OG tags server-side** when the API serves `index.html`.
   Fixes social previews and crawler titles. No Node, no second service.
2. **A `sitemap.xml` endpoint** generated from the catalog.
3. **Prerendering / SSG** for course pages, if SEO becomes commercially
   important.
4. **Full SSR** only if organic search is a real acquisition channel.

## 14. Answers worth being able to give

**On the architecture:**

> "The SPA is built into the API image and served from `wwwroot`, so the whole
> app is one origin. That was deliberate: one artifact to build and deploy, no
> CORS to keep in sync across four environments, and the auth cookie stays
> same-site so I get `SameSite=Lax` rather than `None`. Config like the Stripe
> publishable key comes from `/api/config` rather than being baked into the
> bundle, so the same image promotes through every environment. If the frontend
> needed independent deploys or edge caching I would move `dist/` to a CDN and
> put path-based routing in front — that keeps the single origin while splitting
> the deployments."

**On "isn't a CDN better?":**

> "For static delivery, yes, and I would add one when there is traffic to
> justify it. The bundle is 540 KB and browser-cached after first load, so a CDN
> saves maybe 100 ms on a first visit against a second deploy target and a
> cache-invalidation story. The important part is that the choice is reversible:
> assets are content-hashed and immutable, and config is fetched at runtime, so
> moving to a CDN is a deployment change rather than a code change."

**On CSRF:**

> "JWT in an HttpOnly cookie plus a CSRF double-submit token. Same-origin means
> `SameSite=Lax`, so the browser refuses to attach the cookie to cross-site
> POSTs — that is the primary defense and the token is defense in depth, which
> matters because subdomains are same-site and a compromised one would otherwise
> get through. Cross-origin on a different registrable domain would force
> `SameSite=None`, the third-party-cookie setting Safari already blocks, so I
> would want a shared parent domain or an edge proxy to stay first-party."

The pattern in all three: **name the tradeoff, say what you chose, say what
would change your mind.**

---

## Questions

1. What are the three files `npm run build` produces, and which one is the
   manifest?
2. A hard refresh on `/courses/abc-123` returns 404. What is the cause and what
   are the two fixes, in nginx and in ASP.NET?
3. `app.example.com` and `api.example.com` — same origin, same site, or neither?
   What does each answer imply?
4. Why is `km_csrf` deliberately *not* `HttpOnly` when `km_at` is?
5. An attacker's site can make your browser send your auth cookie. Why can it
   not send a valid `X-CSRF` header?
6. Why does CORS not protect your API from curl?
7. Why should `index.html` be uncached while `/assets/*` is cached for a year?
8. You already rate limit in the API. Name one attack the edge stops that your
   app cannot, and one your app stops that the edge cannot.
9. Vite bakes `VITE_*` into the bundle at build time. Why is that a problem for
   four environments, and what is the fix?
10. What would adopting SSR force you to add, and what is the cheaper way to get
    correct social previews?
