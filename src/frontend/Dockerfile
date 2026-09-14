# Packages the SPA into an image that serves it.
#
#     docker build -f src/frontend/Dockerfile -t knowledge-market-web src/frontend
#                                                                     ^^^^^^^^^^^^
# The build context is THIS folder, not the repository root. The API needs the
# repo root because Api.csproj references ten sibling projects; the frontend
# needs nothing outside src/frontend, so the context is smaller and the COPY
# paths below are relative to this directory.
#
# Two stages. Node compiles the TypeScript and React into three static files,
# then is thrown away. nginx — which is a few megabytes and contains no
# compiler — is what actually ships.


# ---------------------------------------------------------------------------
# Stage 1: compile the SPA
# ---------------------------------------------------------------------------
# Node is a BUILD tool here, exactly like the .NET SDK in src/Api/Dockerfile.
# The browser cannot run .tsx files, so something has to turn them into
# JavaScript. Nothing from this stage reaches the final image except dist/.
#
# Alpine uses musl libc rather than glibc, which matters because rollup and
# esbuild ship compiled binaries per platform. package-lock.json records every
# platform variant including linux-x64-musl, so npm ci resolves correctly here.
FROM node:22-alpine AS build
WORKDIR /app

# Manifest and lockfile first, then install — the same layer-caching trick the
# API Dockerfile uses with .csproj files. Dependencies change far less often
# than source, so this layer survives most commits and npm ci is skipped.
COPY package.json package-lock.json ./

# `npm ci`, never `npm install`:
#   - installs exactly what the lockfile pins, and fails if package.json and
#     the lockfile disagree rather than quietly resolving something different
#   - deletes node_modules first, so the result cannot depend on what was there
#   - never writes to package-lock.json, so a build cannot mutate a tracked file
#
# Deliberately no NODE_ENV=production: vite, typescript and tailwind are all
# devDependencies, and omitting them fails with "sh: vite: not found".
RUN npm ci

# Now the source. Changes on nearly every commit, which is why it comes last.
# .dockerignore keeps the host's node_modules out — it holds Windows binaries
# (@rollup/rollup-win32-x64-msvc) that would break this Linux build.
COPY . .

# Runs `tsc -b && vite build`. A TypeScript error fails the image build, which
# is what you want. Output lands in /app/dist: index.html plus one content
# hashed .js and .css.
RUN npm run build


# ---------------------------------------------------------------------------
# Stage 2: serve the SPA
# ---------------------------------------------------------------------------
# The unprivileged nginx image runs as uid 101 and listens on 8080 out of the
# box. The standard nginx image starts as root to bind port 80 and needs write
# access to several directories; this variant is built to avoid all of that, so
# there is no chown dance and nothing runs as root.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Routing, caching and proxy rules. Replaces the image's default site config.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The whole point of stage 1. --from=build reads from that stage's filesystem,
# NOT from your machine — your local dist/ is excluded by .dockerignore and is
# never used. The files are baked into this image and nginx serves them off its
# own disk.
COPY --from=build /app/dist /usr/share/nginx/html

# Documentation only; publishing is `docker run -p`. 8080 rather than 80
# because ports below 1024 require root and this container is not root.
EXPOSE 8080

# wget comes from busybox in the Alpine base, so no package needs installing.
# Hits /healthz, which returns a fixed string rather than the app shell.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:8080/healthz || exit 1
