# Packages the API into a self-contained, runnable image.
#
#     docker build -f src/Api/Dockerfile -t knowledge-market-api .
#                                                                ^
# The build context is the REPOSITORY ROOT, not this folder, because the build
# needs every project the API references. Run it from the root or the COPY
# paths below will not resolve.
#
# This is a different job from docker-compose.yml. Compose runs the
# dependencies so you can develop against them; this file packages the app so
# CI, staging and production can run the exact same artifact.


# ---------------------------------------------------------------------------
# Stage 1: build
# ---------------------------------------------------------------------------
# The SDK image is ~850MB of compilers, MSBuild and NuGet. It is a build tool,
# not a runtime. Nothing from it reaches the final image except the compiled
# output stage 2 explicitly copies out. That is the whole point of a
# multi-stage build: build fat, ship thin.
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy ONLY the project files, then restore.
#
# Docker caches every instruction and reuses the cached layer when the
# instruction and the files it copies are unchanged. Restore is the slow step
# because it goes to nuget.org, and its real inputs are the .csproj files, not
# the .cs files. Copying just the .csproj files first means editing an endpoint
# does not invalidate the restore layer, and a rebuild takes seconds instead of
# minutes.
#
# One line per project, deliberately. `COPY src/ ./src/` would pull the source
# in too and defeat the entire optimisation.
COPY src/Api/Api.csproj                                        src/Api/
COPY src/Application/Application.csproj                        src/Application/
COPY src/Infrastructure/Infrastructure.csproj                  src/Infrastructure/
COPY src/Domain.Cart/Domain.Cart.csproj                        src/Domain.Cart/
COPY src/Domain.Catalog/Domain.Catalog.csproj                  src/Domain.Catalog/
COPY src/Domain.Content/Domain.Content.csproj                  src/Domain.Content/
COPY src/Domain.Contracts/Domain.Contracts.csproj              src/Domain.Contracts/
COPY src/Domain.Identity/Domain.Identity.csproj                src/Domain.Identity/
COPY src/Domain.Orders/Domain.Orders.csproj                    src/Domain.Orders/
COPY src/Shared/Shared.Abstractions/Shared.Abstractions.csproj src/Shared/Shared.Abstractions/
COPY src/Shared/Shared.Kernel/Shared.Kernel.csproj             src/Shared/Shared.Kernel/

# Restoring the API restores its project references transitively, so this one
# command covers all eleven. The .sln is deliberately not copied: it also lists
# the two test projects, and restoring it would fail on csproj files that are
# not in this image. Tests run in CI, not in the release image.
RUN dotnet restore src/Api/Api.csproj

# Now the source. This layer changes on almost every commit, which is exactly
# why it comes after restore rather than before.
COPY src/ src/

# --no-restore is what makes the cached restore layer pay off. Without it,
# publish quietly restores a second time and the caching above buys nothing.
RUN dotnet publish src/Api/Api.csproj \
      --configuration Release \
      --no-restore \
      --output /app/publish


# ---------------------------------------------------------------------------
# Stage 2: runtime
# ---------------------------------------------------------------------------
# ~220MB against the SDK's ~850MB, and it contains no compiler, so a remote
# code execution bug cannot build and run new code in place.
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

# curl exists solely for HEALTHCHECK below. The base image ships almost no
# shell utilities on purpose: every binary in a runtime image is attack
# surface. Clearing the apt lists in the SAME instruction matters, because a
# separate `RUN rm` would leave them in the earlier layer forever.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# Run as a normal user. Containers run as root by default, and root inside the
# container is root on the host kernel: a container escape or a path traversal
# bug then lands on an account that owns everything rather than nothing.
#
# The UID is pinned rather than auto-assigned so file ownership on a mounted
# volume is predictable, and so an orchestrator's runAsNonRoot check can verify
# it without resolving a name.
RUN adduser --system --uid 10001 --group --no-create-home appuser

COPY --from=build /app/publish ./

# With Storage:Provider=local the app writes uploads to Storage/ and lesson
# markdown to content/, creating both at startup. Everything copied above is
# root-owned, so without this the first upload dies with
# UnauthorizedAccessException. Mount volumes over these paths in any real
# deployment: a container filesystem is disposable and per-instance.
RUN mkdir -p /app/Storage /app/content \
 && chown appuser:appuser /app/Storage /app/content

USER appuser

# Outside a container Kestrel picks ports 5000/5001. A container gets one
# well-known port instead, and 8080 is above 1024 so a non-root user may bind
# it. Binding to + rather than localhost is required: localhost inside the
# container is not reachable from outside it.
ENV ASPNETCORE_URLS=http://+:8080

# Documentation only. It does not publish anything - that is `docker run -p`.
# Its real use is telling a reader, and `docker run -P`, which port matters.
EXPOSE 8080

# ASPNETCORE_ENVIRONMENT is deliberately NOT set. Unset means Production, so
# the image defaults to its most locked-down behaviour: ProductionConfigValidator
# refuses to start without real configuration and the development-only seeding
# endpoints are never mapped. The environment is supplied at run time, so one
# image is built once and promoted unchanged through dev, qa, staging and prod.
# Baking the environment in would mean four different images and four different
# things to test.

# Docker restarts nothing on its own; this only marks the container unhealthy,
# which is what a compose `depends_on: condition: service_healthy` and most
# schedulers watch. /health is the liveness endpoint and runs no dependency
# checks - /health/ready is the one that queries SQL Server, and using it here
# would report the app unhealthy during a database blip it will recover from.
# Under Kubernetes you drop this line entirely and declare probes in the
# manifest, where the scheduler can act on them.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:8080/health || exit 1

# Exec form, not shell form. Shell form would wrap the app in /bin/sh, which
# does not forward SIGTERM, so `docker stop` would hang for its full ten-second
# timeout and then kill the process instead of letting ASP.NET drain requests.
ENTRYPOINT ["dotnet", "Api.dll"]
