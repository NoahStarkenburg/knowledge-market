# Packages the SPA into an image that serves it.
#
#     docker build -f src/frontend/Dockerfile -t knowledge-market-web src/frontend
#                                                                     ^^^^^^^^^^^^
# The build context is THIS folder, not the repository root. The API needs the
# repo root because Api.csproj references ten sibling projects; the frontend
# needs nothing outside src/frontend, so the context is smaller and the COPY
# paths below are relative to this directory.
#
# Two stages. Node compiles the TypeScript and Angular templates into static
# files, then is thrown away. nginx — which is a few megabytes and contains no
# compiler — is what actually ships.


# ---------------------------------------------------------------------------
# Stage 1: compile the SPA
# ---------------------------------------------------------------------------
# Node is a BUILD tool here, exactly like the .NET SDK in src/Api/Dockerfile.
# The browser cannot run TypeScript or Angular templates, so something has to
# compile them into JavaScript. Nothing from this stage reaches the final image
# except the build output.
#
# Alpine uses musl libc rather than glibc, which matters because esbuild and
# friends ship compiled binaries per platform. package-lock.json records every
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
# Deliberately no NODE_ENV=production: the Angular CLI, TypeScript and Tailwind
# are all devDependencies, and omitting them fails the build.
RUN npm ci

# Now the source. Changes on nearly every commit, which is why it comes last.
# .dockerignore keeps the host's node_modules out — it holds Windows binaries
# (@esbuild/win32-x64) that would break this Linux build.
COPY . .

# Public, per-deployment values compiled into the bundle.
#
# The Angular compiler replaces each identifier declared in
# src/build-config.d.ts with the value given by --define, so these have to
# exist NOW, as build arguments, not when the container runs. Every one is
# public by design — a Stripe PUBLISHABLE key and an OAuth client ID identify
# the app, they do not authorize anything — so it is fine that they end up
# readable in the shipped JavaScript. A secret must never be passed this way:
# build args are visible in `docker history`.
#
#     docker build --build-arg STRIPE_PUBLISHABLE_KEY=pk_test_... ...
#
# Declared here, just before the build, rather than at the top of the stage:
# changing one only invalidates the layers after it, so npm ci stays cached.
ARG STRIPE_PUBLISHABLE_KEY=""
ARG GOOGLE_AUTH="false"
ARG GOOGLE_CLIENT_ID=""
ARG GOOGLE_API_KEY=""

# A type or template error fails the image build, which is what you want.
# Output lands in /app/dist/frontend/browser: index.html plus content-hashed
# .js and .css files. The inner single quotes make each value a JavaScript
# string literal, which is what --define substitutes.
RUN npx ng build --configuration production \
      --define "STRIPE_PUBLISHABLE_KEY='${STRIPE_PUBLISHABLE_KEY}'" \
      --define "GOOGLE_AUTH='${GOOGLE_AUTH}'" \
      --define "GOOGLE_CLIENT_ID='${GOOGLE_CLIENT_ID}'" \
      --define "GOOGLE_API_KEY='${GOOGLE_API_KEY}'"


# ---------------------------------------------------------------------------
# Stage 2: serve the SPA
# ---------------------------------------------------------------------------
# The unprivileged nginx image runs as uid 101 and listens on 8080 out of the
# box. The standard nginx image starts as root to bind port 80 and needs write
# access to several directories; this variant is built to avoid all of that, so
# there is no chown dance and nothing runs as root.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Routing, caching and proxy rules, as a TEMPLATE. The image renders every file
# in /etc/nginx/templates at startup, substituting environment variables, and
# writes the result over /etc/nginx/conf.d/default.conf. That is what lets one
# image run under compose and in Azure with different upstreams.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Defaults for every ${NAME} in the template. They matter: the render step only
# replaces variables that are SET, so an unset one would be left in the config
# as literal "${NAME}" text. These values are the compose ones; Azure overrides
# them on the container.
#
# NGINX_ENTRYPOINT_LOCAL_RESOLVERS turns on a startup script that reads the DNS
# server from /etc/resolv.conf into NGINX_LOCAL_RESOLVERS, so the resolver is
# correct in whichever environment the container lands in.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1     API_UPSTREAM=api:8080     API_HOST=api     FRONT_DOOR_ID=

# The whole point of stage 1. --from=build reads from that stage's filesystem,
# NOT from your machine — your local dist/ is excluded by .dockerignore and is
# never used. The files are baked into this image and nginx serves them off its
# own disk.
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

# Documentation only; publishing is `docker run -p`. 8080 rather than 80
# because ports below 1024 require root and this container is not root.
EXPOSE 8080

# wget comes from busybox in the Alpine base, so no package needs installing.
# Hits /healthz, which returns a fixed string rather than the app shell.
#
# 127.0.0.1, not localhost. The image's /etc/hosts maps localhost to both
# 127.0.0.1 and ::1, busybox wget tries ::1 first, and nginx listens on IPv4
# only (`listen 8080`). With localhost the check is refused and the container
# is reported unhealthy while it serves traffic perfectly well.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
