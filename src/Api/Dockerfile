# 1) Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy solution + project files first (better layer caching)
COPY *.sln ./
COPY src/Api/*.csproj ./src/Api/
COPY src/Contracts/*.csproj ./src/Contracts/
COPY src/Infrastructure/*.csproj ./src/Infrastructure/
COPY src/Domain.Identity/*.csproj ./src/Domain.Identity/
COPY src/Domain.Catalog/*.csproj ./src/Domain.Catalog/
COPY src/Domain.Orders/*.csproj ./src/Domain.Orders/
COPY src/Domain.Payments/*.csproj ./src/Domain.Payments/
COPY src/Domain.Media/*.csproj ./src/Domain.Media/
COPY src/Domain.Search/*.csproj ./src/Domain.Search/
COPY src/Worker/*.csproj ./src/Worker/

# Restore dependencies
RUN dotnet restore ./src/Api/Api.csproj

# Copy everything and build/publish
COPY . .
RUN dotnet publish ./src/Api/Api.csproj -c Release -o /app/publish

# 2) Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN adduser --disabled-password --gecos "" appuser

COPY --from=build /app/publish ./

# Kestrel listens on port 8080 in containers
ENV ASPNETCORE_URLS=http://+:8080

# Use Docker environment so appsettings.Docker.json is loaded
ENV ASPNETCORE_ENVIRONMENT=Docker

EXPOSE 8080

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# ENTRYPOINT for the API
ENTRYPOINT ["dotnet", "Api.dll"]
