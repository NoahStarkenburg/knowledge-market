using System.Security.Claims;
using Application.Abstractions;
using Shared.Abstractions;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Amazon.S3;
using Azure.Identity;
using Azure.Storage.Blobs;
using Api.Authorization;
using Api.Authorization.AccessService;
using Api.Authorization.Handlers;
using Api.Authorization.Policies;
using Api.Configuration;
using Infrastructure.Storage;
using Api.DataSeeding;
using Infrastructure.Email;
using Api.Endpoints;
using Infrastructure.Payments;
using Infrastructure.Storage;
using Infrastructure.Catalog;
using Infrastructure.Content;
using Infrastructure.Database;
using Infrastructure.Identity;
using Infrastructure.Orders;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;
using FluentValidation;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog.Sinks.OpenTelemetry;
using Azure.Monitor.OpenTelemetry.AspNetCore;
using Microsoft.AspNetCore.HttpOverrides;
using OpenTelemetry.Instrumentation.AspNetCore;
using Api.Observability;
using Shared.Kernel;
using Infrastructure.Cart;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{

var builder = WebApplication.CreateBuilder(args);

// ---------------- Configuration ----------------
// CreateBuilder already registers, in precedence order: appsettings.json,
// appsettings.{Environment}.json, user secrets (Development only), environment
// variables, command line. Re-adding any of those here would append a second
// copy, and since later sources win, the empty placeholders in appsettings.json
// would silently override real values coming from user secrets.

// Fail fast in Production if any critical secret is still a placeholder or is missing.
ProductionConfigValidator.Validate(builder.Configuration, builder.Environment);

// Serilog: structured logs to console, and shipped to the OpenTelemetry collector
// (Grafana/Loki) when an OTLP endpoint is configured, correlated with traces.
builder.Host.UseSerilog((ctx, svc, cfg) =>
{
    cfg.ReadFrom.Configuration(ctx.Configuration)
       .ReadFrom.Services(svc);

    // A person reads the console when running locally; a machine reads it everywhere else.
    if (ctx.HostingEnvironment.IsDevelopment())
    {
        cfg.WriteTo.Console(outputTemplate:
            "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} <s:{SourceContext}>{NewLine}{Exception}");
    }
    else
    {
        cfg.WriteTo.Console(new CompactJsonFormatter());
    }

    var otlp = ctx.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"];
    if (!string.IsNullOrWhiteSpace(otlp))
    {
        cfg.WriteTo.OpenTelemetry(o =>
        {
            o.Endpoint = otlp.TrimEnd('/') + "/v1/logs";
            o.Protocol = OtlpProtocol.HttpProtobuf;
            o.ResourceAttributes = new Dictionary<string, object>
            {
                ["service.name"] = ObservabilityDefaults.ServiceName,
                ["service.version"] = ObservabilityDefaults.ServiceVersion,
                ["deployment.environment"] = ctx.HostingEnvironment.EnvironmentName,
                ["service.instance.id"] = Environment.MachineName,
            };
        });
    }
});

// OpenTelemetry: distributed traces + application/runtime metrics. Two destinations,
// each switched on by the presence of its own setting, so nothing is exported locally:
//   - OTLP to a collector (Grafana Tempo/Prometheus) when OTEL_EXPORTER_OTLP_ENDPOINT is set.
//     The exporter reads OTEL_EXPORTER_OTLP_ENDPOINT / OTEL_EXPORTER_OTLP_PROTOCOL from env.
//   - Azure Monitor (Application Insights) when APPLICATIONINSIGHTS_CONNECTION_STRING is set.
// Both can run at once; the instrumentation is the same, only the exporters differ.
var otlpEndpoint = builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"];
var exportOtlp = !string.IsNullOrWhiteSpace(otlpEndpoint);
var exportAzureMonitor = !string.IsNullOrWhiteSpace(builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]);
if (exportOtlp || exportAzureMonitor)
{
    // Configured once as options rather than inline, because the Azure Monitor distro
    // registers its own ASP.NET Core instrumentation and reads these same options.
    // Container probes hit /health every 30s. Left in, they bury real requests in every
    // trace view and skew every span-metric derived from the trace stream.
    builder.Services.Configure<AspNetCoreTraceInstrumentationOptions>(o =>
    {
        o.Filter = ctx => !ObservabilityDefaults.IsProbePath(ctx.Request.Path);
        o.RecordException = true;
    });

    var telemetry = builder.Services.AddOpenTelemetry()
        .ConfigureResource(r => r
            .AddService(serviceName: ObservabilityDefaults.ServiceName, serviceVersion: ObservabilityDefaults.ServiceVersion)
            .AddAttributes(new Dictionary<string, object>
            {
                // Lets one Grafana stack tell Docker apart from Production, and one replica
                // apart from another, without a separate datasource per environment.
                ["deployment.environment"] = builder.Environment.EnvironmentName,
                ["service.instance.id"] = Environment.MachineName,
            }))
        .WithTracing(t =>
        {
            t.AddSource(AppDiagnostics.SourceName);  // our business spans (purchase, checkout, cache)

            // The Azure Monitor distro already instruments ASP.NET Core, HttpClient and
            // SqlClient. Registering them a second time would emit every span twice.
            if (!exportAzureMonitor)
            {
                t.AddAspNetCoreInstrumentation()
                 .AddHttpClientInstrumentation()
                 .AddSqlClientInstrumentation();     // a span per SQL query
            }

            if (exportOtlp) t.AddOtlpExporter();
        })
        .WithMetrics(m =>
        {
            m.AddRuntimeInstrumentation()             // GC, thread pool, exceptions
             .AddMeter(AppMetrics.MeterName);         // our business metrics

            if (!exportAzureMonitor)
            {
                m.AddAspNetCoreInstrumentation()
                 .AddHttpClientInstrumentation()
                 .AddSqlClientInstrumentation();     // DB command duration metrics
            }

            if (exportOtlp) m.AddOtlpExporter();
        });

    // Reads APPLICATIONINSIGHTS_CONNECTION_STRING itself. Logs are deliberately not routed
    // here: Serilog already writes JSON to stdout, and Container Apps ships stdout to Log
    // Analytics, so sending them to Application Insights as well would pay for them twice.
    if (exportAzureMonitor) telemetry.UseAzureMonitor();
}

// ---------------- Forwarded headers ----------------
// Behind nginx, every request reaches this API from nginx's address, over plain HTTP, with
// nginx's idea of the Host. Left alone that breaks three things:
//   - rate limiting partitions by RemoteIpAddress, so every visitor shares ONE bucket and a
//     single user's failed logins lock everybody out
//   - Request.Scheme is "http", so anything building an absolute URL builds the wrong one
//   - Request.Host is the internal container name rather than the public hostname
//
// nginx works out the real values and sends them in X-Client-* headers. Custom names rather
// than the standard X-Forwarded-*, because Azure Container Apps' own ingress proxy sits
// between nginx and this API and rewrites X-Forwarded-For/-Proto on the way through.
//
// Trusting these headers is only safe because nothing but nginx can reach this API: in
// compose it publishes no port, and in Azure it has internal-only ingress. That is why it is
// off by default: `dotnet run` exposes :5116 directly, and there anyone could forge them.
var forwardedHeadersEnabled = builder.Configuration.GetValue<bool>("ForwardedHeaders:Enabled");
if (forwardedHeadersEnabled)
{
    builder.Services.Configure<ForwardedHeadersOptions>(o =>
    {
        o.ForwardedHeaders = ForwardedHeaders.XForwardedFor
                           | ForwardedHeaders.XForwardedProto
                           | ForwardedHeaders.XForwardedHost;
        o.ForwardedForHeaderName = "X-Client-IP";
        o.ForwardedProtoHeaderName = "X-Client-Proto";
        o.ForwardedHostHeaderName = "X-Client-Host";

        // nginx sends exactly one value per header, already resolved.
        o.ForwardLimit = 1;

        // By default only loopback proxies are trusted, which would ignore nginx entirely.
        // The network boundary described above is what makes clearing these acceptable.
        o.KnownNetworks.Clear();
        o.KnownProxies.Clear();
    });
}

// Business metrics (signups, logins, orders, payments, cache) on the KnowledgeMarket meter.
builder.Services.AddSingleton<AppMetrics>();

// ---------------- Services ----------------

// EF Core (SQL Server) — one database, a schema per bounded context, and a
// separate __EFMigrationsHistory table inside each so contexts migrate independently.
builder.Services.AddDbContext<UsersDbContext>(opt =>
{
    var conn = builder.Configuration.GetConnectionString("Default");
    opt.UseSqlServer(conn, b => b.MigrationsHistoryTable("__EFMigrationsHistory", "identity"))
       .AddInterceptors(SqlConnectionRetryInterceptor.Instance);
});
builder.Services.AddDbContext<CatalogDbContext>(opt =>
{
    var conn = builder.Configuration.GetConnectionString("Default");
    opt.UseSqlServer(conn, b => b.MigrationsHistoryTable("__EFMigrationsHistory", "catalog"))
       .AddInterceptors(SqlConnectionRetryInterceptor.Instance);
});
builder.Services.AddDbContext<OrdersDbContext>(opt =>
{
    var conn = builder.Configuration.GetConnectionString("Default");
    opt.UseSqlServer(conn, b => b.MigrationsHistoryTable("__EFMigrationsHistory", "orders"))
       .AddInterceptors(SqlConnectionRetryInterceptor.Instance);
});
builder.Services.AddDbContext<ContentDbContext>(opt =>
{
    var conn = builder.Configuration.GetConnectionString("Default");
    opt.UseSqlServer(conn, b => b.MigrationsHistoryTable("__EFMigrationsHistory", "content"))
       .AddInterceptors(SqlConnectionRetryInterceptor.Instance);
});
builder.Services.AddDbContext<Infrastructure.Cart.CartDbContext>(opt =>
{
    var conn = builder.Configuration.GetConnectionString("Default");
    opt.UseSqlServer(conn, b => b.MigrationsHistoryTable("__EFMigrationsHistory", "carts"))
       .AddInterceptors(SqlConnectionRetryInterceptor.Instance);
});

// Distributed cache (Redis). Optional: when Redis is configured (a local connection string, or an
// Azure Managed Redis host signed into with the managed identity) we wire the real Redis-backed
// cache; otherwise a no-op store keeps the app running unchanged without Redis. The one connection
// is shared by the cache and its health check below.
var redis = await Infrastructure.Caching.RedisConnectionFactory.ConnectAsync(builder.Configuration);
if (redis is not null)
{
    builder.Services.AddSingleton(redis);
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.ConnectionMultiplexerFactory = () => Task.FromResult(redis);
        options.InstanceName = "km:"; // key prefix, so this app's keys are easy to spot in redis-cli
    });
    builder.Services.AddSingleton<Shared.Abstractions.ICacheStore, Infrastructure.Caching.RedisCacheStore>();
}
else
{
    builder.Services.AddSingleton<Shared.Abstractions.ICacheStore, Infrastructure.Caching.NullCacheStore>();
}

// Single-flight coalescer for cache rebuilds. Singleton so its in-flight table is shared across
// concurrent requests (that sharing is what collapses a stampede into one rebuild).
builder.Services.AddSingleton<Shared.Kernel.SingleFlight>();

// App dependencies
builder.Services.AddScoped<IAccessService, AccessService>();
builder.Services.AddScoped<IAuthorizationHandler, CourseAuthorizationHandler>();
builder.Services.AddScoped<IAuthorizationHandler, LessonAuthorizationHandler>();


var storageProvider = builder.Configuration["Storage:Provider"] ?? "local";

if (storageProvider == "s3")
{
    builder.Services.AddSingleton<IAmazonS3>(sp =>
    {
        var cfg = sp.GetRequiredService<IConfiguration>();
        var serviceUrl = cfg["Storage:S3:ServiceUrl"];
        var accessKey = cfg["Storage:S3:AccessKey"];
        var secretKey = cfg["Storage:S3:SecretKey"];

        // A custom endpoint means an S3-compatible store like MinIO: explicit endpoint,
        // path-style addressing, and static credentials.
        if (!string.IsNullOrWhiteSpace(serviceUrl))
        {
            return new AmazonS3Client(accessKey, secretKey, new AmazonS3Config
            {
                ServiceURL = serviceUrl,
                ForcePathStyle = true,
                UseHttp = serviceUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase),
            });
        }

        // Real AWS S3: region from config; credentials from the default chain (the task/
        // instance IAM role in production), falling back to static keys if explicitly set.
        var awsCfg = new AmazonS3Config();
        var region = cfg["Storage:S3:Region"];
        if (!string.IsNullOrWhiteSpace(region))
            awsCfg.RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(region);

        return (!string.IsNullOrWhiteSpace(accessKey) && !string.IsNullOrWhiteSpace(secretKey))
            ? new AmazonS3Client(accessKey, secretKey, awsCfg)
            : new AmazonS3Client(awsCfg);
    });

    builder.Services.AddScoped<Shared.Abstractions.IStorage, S3Storage>();
    builder.Services.AddSingleton<Shared.Abstractions.IContentStorage, S3ContentStorage>();
    builder.Services.AddHostedService<S3BucketInitializer>();
}
else if (storageProvider == "azureblob")
{
    var blobConnectionString = builder.Configuration["Storage:AzureBlob:ConnectionString"];

    builder.Services.AddSingleton(sp =>
    {
        // A connection string carries an account key, so it is only for Azurite, whose key is
        // public. ProductionConfigValidator refuses one in Production.
        if (!string.IsNullOrWhiteSpace(blobConnectionString))
            return new BlobServiceClient(blobConnectionString);

        // In Azure there is no key at all. DefaultAzureCredential finds the container app's managed
        // identity (AZURE_CLIENT_ID picks which one), or your `az login` when run on a laptop.
        var serviceUri = sp.GetRequiredService<IConfiguration>()["Storage:AzureBlob:ServiceUri"];
        return new BlobServiceClient(new Uri(serviceUri!), new DefaultAzureCredential());
    });

    builder.Services.AddSingleton<AzureBlobSasSigner>();
    builder.Services.AddScoped<Shared.Abstractions.IStorage, AzureBlobStorage>();
    builder.Services.AddSingleton<Shared.Abstractions.IContentStorage, AzureBlobContentStorage>();

    if (!string.IsNullOrWhiteSpace(blobConnectionString))
        builder.Services.AddHostedService<AzureBlobEmulatorInitializer>();
}
else
{
    builder.Services.AddSingleton<Shared.Abstractions.IContentStorage, LocalContentStorage>();
    builder.Services.AddScoped<Shared.Abstractions.IStorage, LocalStorage>();
}

builder.Services.AddScoped<ITokenService, TokenService>();

// Layered Users context (Phase 2): controller -> service -> repository.
builder.Services.AddScoped<Application.Abstractions.IUserRepository, Infrastructure.Identity.UserRepository>();
builder.Services.AddScoped<Application.Users.IUserService, Application.Users.UserService>();

// Layered Catalog context (Phase 3).
builder.Services.AddScoped<Application.Abstractions.ICourseRepository, Infrastructure.Catalog.CourseRepository>();
builder.Services.AddScoped<Application.Catalog.ICourseService, Application.Catalog.CourseService>();

// Layered Orders context (Phase 4).
builder.Services.AddScoped<Application.Abstractions.IOrderRepository, Infrastructure.Orders.OrderRepository>();
builder.Services.AddScoped<Application.Orders.IOrderService, Application.Orders.OrderService>();

// Layered Content context (Phase 5).
builder.Services.AddScoped<Application.Abstractions.IContentRepository, Infrastructure.Content.ContentRepository>();
builder.Services.AddScoped<Application.Content.ILessonService, Application.Content.LessonService>();
builder.Services.AddScoped<Application.Content.ILessonAssetService, Application.Content.LessonAssetService>();
builder.Services.AddScoped<Application.Content.ILessonTextService, Application.Content.LessonTextService>();

// Layered Uploads/Media context (Phase 6).
builder.Services.AddScoped<Application.Abstractions.IMediaRepository, Infrastructure.Media.MediaRepository>();
builder.Services.AddScoped<Application.Uploads.IUploadService, Application.Uploads.UploadService>();

// Layered Creator context (Phase 7).
builder.Services.AddScoped<Application.Abstractions.ICreatorRepository, Infrastructure.Creator.CreatorRepository>();
builder.Services.AddScoped<Application.Creator.ICreatorService, Application.Creator.CreatorService>();

// Layered Cart context 
builder.Services.AddScoped<Application.Abstractions.ICartRepository, Infrastructure.Cart.CartRepository>();
builder.Services.AddScoped<Application.Cart.ICartService, Application.Cart.CartService>();

// Email
var emailProvider = builder.Configuration["Email:Provider"] ?? "null";
if (emailProvider == "smtp")
    builder.Services.AddScoped<IEmailService, SmtpEmailService>();
else if (emailProvider == "acs")
{
    // Azure Communication Services, signed into with the managed identity (AZURE_CLIENT_ID picks it).
    var acsEndpoint = builder.Configuration["Email:Acs:Endpoint"];
    builder.Services.AddSingleton(_ => new Azure.Communication.Email.EmailClient(new Uri(acsEndpoint!), new DefaultAzureCredential()));
    builder.Services.AddScoped<IEmailService, AcsEmailService>();
}
else
    builder.Services.AddScoped<IEmailService, NullEmailService>();

// Stripe
builder.Services.AddScoped<Application.Abstractions.IPaymentService, StripePaymentService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<BulkDataSeeder>();

// Current user: JWT
builder.Services.AddScoped<ICurrentUser, JwtCurrentUser>();

// Seed admin role assignment
builder.Services.AddHostedService<AdminSeederHostedService>();
// Purge expired refresh tokens daily
builder.Services.AddHostedService<RefreshTokenCleanupService>();

// No CORS policy. The SPA and the API share one origin in every environment (the Vite dev
// proxy locally, nginx in containers, Front Door in production), so the browser never makes
// a cross-origin request to this API and there is nothing to allow. Adding a policy back
// would only widen who may read responses with credentials attached.

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddDataProtection()
        .PersistKeysToFileSystem(new DirectoryInfo(
            Path.Combine(builder.Environment.ContentRootPath, "DataProtectionKeys")))
        .SetApplicationName("KnowledgeMarket");
}
else
{
    builder.Services.AddDataProtection()
        .PersistKeysToDbContext<UsersDbContext>()
        .SetApplicationName("KnowledgeMarket");
}

// Health Checks. "ready" means the dependency must be up for the app to serve traffic;
// everything else is reported for humans but never gates the readiness probe. Redis is
// deliberately NOT tagged ready — the cache degrades to a miss, so an outage should show
// up as degraded, not pull the instance out of rotation.
var healthChecks = builder.Services.AddHealthChecks()
    .AddSqlServer(builder.Configuration.GetConnectionString("Default")!, name: "sqlserver", tags: ["db", "ready"]);

if (redis is not null)
{
    healthChecks.AddRedis(redis, name: "redis", tags: ["cache"]);
}

if (string.Equals(builder.Configuration["Storage:Provider"], "s3", StringComparison.OrdinalIgnoreCase))
{
    healthChecks.AddCheck<Infrastructure.Storage.StorageHealthCheck>("storage", tags: ["storage", "ready"]);
}
else if (string.Equals(builder.Configuration["Storage:Provider"], "azureblob", StringComparison.OrdinalIgnoreCase))
{
    healthChecks.AddCheck<AzureBlobHealthCheck>("storage", tags: ["storage", "ready"]);
}

// MVC controllers (layered refactor). Registered alongside the minimal APIs so both run
// during the strangler-fig migration; each context moves to a controller one phase at a time.
builder.Services.AddControllers(options =>
{
    options.Filters.Add<Api.Filters.ApiExceptionFilter>();
});

// AutoMapper profiles and FluentValidation validators from the Application layer.
builder.Services.AddAutoMapper(typeof(Application.IApplicationAssemblyMarker).Assembly);
builder.Services.AddValidatorsFromAssembly(typeof(Application.IApplicationAssemblyMarker).Assembly);

// Problem Details
builder.Services.AddProblemDetails();
// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "KnowledgeMarket API", Version = "v1" });

    // Keep Bearer for tooling (Postman/Swagger), even though browser auth will use cookies.
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter: Bearer {your JWT}"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Id = "Bearer", Type = ReferenceType.SecurityScheme }
            },
            Array.Empty<string>()
        }
    });
});

// Authentication (JWT in HttpOnly cookie, with Authorization header fallback)
var jwt = builder.Configuration.GetSection("Jwt");
var authBuilder = builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt["Issuer"],
            ValidAudience = jwt["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["SigningKey"]!)),
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2),
            RoleClaimType = ClaimTypes.Role,
            NameClaimType = ClaimTypes.NameIdentifier
        };

        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                // ✅ If Authorization header exists, let default Bearer behavior happen
                // This keeps Swagger/Postman "Authorize" working normally.
                if (ctx.Request.Headers.ContainsKey("Authorization"))
                    return Task.CompletedTask;

                // ✅ Otherwise try the HttpOnly cookie
                if (ctx.Request.Cookies.TryGetValue(AuthCookies.AccessTokenCookie, out var token) &&
                    !string.IsNullOrWhiteSpace(token))
                {
                    ctx.Token = token;
                }

                return Task.CompletedTask;
            }
        };
    });

// Google OAuth is optional: only wired when a client id/secret are configured, so the
// app runs fine without them. Secrets come from env (Authentication__Google__*).
var googleClientId = builder.Configuration["Authentication:Google:ClientId"];
var googleClientSecret = builder.Configuration["Authentication:Google:ClientSecret"];
var googleEnabled = !string.IsNullOrWhiteSpace(googleClientId) && !string.IsNullOrWhiteSpace(googleClientSecret);
if (googleEnabled)
{
    authBuilder
        .AddCookie("External")
        .AddGoogle(o =>
        {
            o.ClientId = googleClientId!;
            o.ClientSecret = googleClientSecret!;
            o.SignInScheme = "External";
            o.CallbackPath = "/signin-google";
        });
}

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("role:admin", p => p.RequireRole("Admin"));
    CoursePolicies.AddCoursePolicies(options);
    LessonPolicies.AddLessonPolicies(options);
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Rate limiting can be turned off (e.g. in integration tests) while keeping the named
    // policies valid so endpoints that call RequireRateLimiting still resolve. Default: on.
    var rateLimitingEnabled = builder.Configuration.GetValue("RateLimiting:Enabled", true);
    if (!rateLimitingEnabled)
    {
        options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(
            _ => RateLimitPartition.GetNoLimiter("none"));
        foreach (var policyName in new[] { "login", "upload", "register", "checkout", "review" })
            options.AddPolicy(policyName, _ => RateLimitPartition.GetNoLimiter("none"));
        return;
    }

    // Global: 200 req/min per user/IP
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
    {
        var key = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            Window = TimeSpan.FromMinutes(1),
            PermitLimit = 200,
            QueueLimit = 0,
        });
    });

    // Login: 10 attempts per minute per IP
    options.AddPolicy("login", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                PermitLimit = 10,
                QueueLimit = 0,
            }));

    // File upload: 20 uploads per minute per user (falls back to IP for anonymous)
    options.AddPolicy("upload", ctx =>
    {
        var key = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? ctx.Connection.RemoteIpAddress?.ToString()
                  ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            Window = TimeSpan.FromMinutes(1),
            PermitLimit = 20,
            QueueLimit = 0,
        });
    });

    // Registration: 5 accounts per hour per IP
    options.AddPolicy("register", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromHours(1),
                PermitLimit = 5,
                QueueLimit = 0,
            }));

    // Checkout: 5/min per user
    options.AddPolicy("checkout", ctx =>
    {
        var key = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            Window = TimeSpan.FromMinutes(1),
            PermitLimit = 5,
            QueueLimit = 0,
        });
    });

    // Reviews: 10/min per user
    options.AddPolicy("review", ctx =>
    {
        var key = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            Window = TimeSpan.FromMinutes(1),
            PermitLimit = 10,
            QueueLimit = 0,
        });
    });
});



var app = builder.Build();

// ---------------- Pipeline ----------------

// First, so everything after it (security headers, request logging, rate limiting) sees
// the real client IP, scheme and host instead of nginx's.
if (forwardedHeadersEnabled)
{
    app.UseForwardedHeaders();
}

// Security headers (non-development). TLS terminates at the load balancer / App Runner,
// so HSTS is emitted here for the browser; a Content-Security-Policy belongs on the SPA's
// CDN (CloudFront), where the HTML is served.
if (!app.Environment.IsDevelopment())
{
    app.Use(async (ctx, next) =>
    {
        var h = ctx.Response.Headers;
        h["X-Content-Type-Options"] = "nosniff";
        h["Referrer-Policy"] = "strict-origin-when-cross-origin";
        h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";

        // File-serving endpoints exist to be embedded by the SPA (inline PDF/image/video
        // previews via <iframe>/<img>/<video>), so they must not be frame-blocked. Everything
        // else stays DENY (these responses are JSON or downloads, not clickjackable UI).
        var path = ctx.Request.Path.Value ?? string.Empty;
        var isEmbeddableContent =
            path.EndsWith("/download", StringComparison.OrdinalIgnoreCase) ||
            path.EndsWith("/thumbnail", StringComparison.OrdinalIgnoreCase) ||
            path.EndsWith("/intro-video", StringComparison.OrdinalIgnoreCase);
        if (!isEmbeddableContent)
            h["X-Frame-Options"] = "DENY";

        await next();
    });
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.InjectJavascript("/swagger-csrf.js");
    });
}

app.UseSerilogRequestLogging(opts =>
{
    opts.MessageTemplate =
        "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";

    // One line per request, at a level that matches what happened: failures are findable
    // without reading everything, and probe traffic stops drowning the stream.
    opts.GetLevel = (ctx, elapsedMs, ex) =>
        ex is not null || ctx.Response.StatusCode >= 500 ? LogEventLevel.Error
        : ObservabilityDefaults.IsProbePath(ctx.Request.Path) ? LogEventLevel.Verbose
        : ctx.Response.StatusCode >= 400 ? LogEventLevel.Warning
        : elapsedMs > 1000 ? LogEventLevel.Warning
        : LogEventLevel.Information;

    opts.EnrichDiagnosticContext = (dc, ctx) =>
    {
        dc.Set("UserId", ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anon");
        dc.Set("ClientIp", ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown");
        dc.Set("UserAgent", ctx.Request.Headers.UserAgent.ToString());
        dc.Set("RequestHost", ctx.Request.Host.Value ?? "");
        // The matched route template ("/api/courses/{id}") rather than the concrete path,
        // so per-endpoint queries group instead of exploding one series per course id.
        if (ctx.GetEndpoint() is RouteEndpoint re) dc.Set("RouteTemplate", re.RoutePattern.RawText ?? "");
    };
});

// Serve SPA if you build to wwwroot (optional)
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseExceptionHandler();
app.UseStatusCodePages(async context =>
{
    var res = context.HttpContext.Response;
    res.ContentType = "application/problem+json";

    var (title, detail) = res.StatusCode switch
    {
        StatusCodes.Status400BadRequest =>
            ("Bad request", "Something about that request was invalid. Please check what you entered and try again."),
        StatusCodes.Status401Unauthorized =>
            ("Sign in required", "You need to be signed in to do that. Please log in and try again."),
        StatusCodes.Status403Forbidden =>
            ("Access denied", "You don't have permission to do that. If you think this is a mistake, contact the course owner."),
        StatusCodes.Status404NotFound =>
            ("Not found", "We couldn't find what you were looking for. It may have been moved or removed."),
        StatusCodes.Status405MethodNotAllowed =>
            ("Action not allowed", "That action isn't supported here."),
        StatusCodes.Status409Conflict =>
            ("Conflict", "That conflicts with something that already exists. Please refresh and try again."),
        StatusCodes.Status413PayloadTooLarge =>
            ("File too large", "That file is too large to upload. Please choose a smaller file."),
        StatusCodes.Status429TooManyRequests =>
            ("Too many requests", "You're doing that a bit too fast. Please wait a moment and try again."),
        >= 500 =>
            ("Something went wrong", "Something went wrong on our end. Please try again in a moment."),
        _ =>
            ("Request failed", "We couldn't complete that request. Please try again.")
    };

    var problem = new ProblemDetails
    {
        Status = res.StatusCode,
        Title = title,
        Detail = detail,
        Extensions = { ["traceId"] = context.HttpContext.TraceIdentifier }
    };

    await res.WriteAsJsonAsync(problem);
});

// Auth
app.UseAuthentication();

// After authentication, so the per-user limits can see who the user is. Placed before it,
// every limit silently fell back to the client address and signed-in users behind one
// address (an office, a phone carrier's NAT) shared a single budget.
app.UseRateLimiter();


// CSRF check (cookie auth requires it for unsafe methods)
app.Use(async (ctx, next) =>
{
    // Only enforce on state-changing verbs
    if (HttpMethods.IsPost(ctx.Request.Method) ||
        HttpMethods.IsPut(ctx.Request.Method) ||
        HttpMethods.IsPatch(ctx.Request.Method) ||
        HttpMethods.IsDelete(ctx.Request.Method))
    {
        // ✅ Use StartsWithSegments to avoid string edge cases
        var isLogin = ctx.Request.Path.StartsWithSegments("/api/auth/login");
        var isRegister = ctx.Request.Path.StartsWithSegments("/api/auth/register");
        var isLogout = ctx.Request.Path.StartsWithSegments("/api/auth/logout");
        var isRefresh = ctx.Request.Path.StartsWithSegments("/api/auth/refresh");
        var isWebhook = ctx.Request.Path.StartsWithSegments("/api/webhooks");
        var isForgotPassword = ctx.Request.Path.StartsWithSegments("/api/auth/forgot-password");
        var isResetPassword = ctx.Request.Path.StartsWithSegments("/api/auth/reset-password");

        // Allow login/register/logout/refresh/webhooks/forgot-password/reset-password without CSRF
        if (!isLogin && !isRegister && !isLogout && !isRefresh && !isWebhook && !isForgotPassword && !isResetPassword)
        {
            var csrfCookie = ctx.Request.Cookies[AuthCookies.CsrfCookie];
            var csrfHeader = ctx.Request.Headers[AuthCookies.CsrfHeader].ToString();

            if (string.IsNullOrWhiteSpace(csrfCookie) ||
                string.IsNullOrWhiteSpace(csrfHeader) ||
                !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(csrfCookie), Encoding.UTF8.GetBytes(csrfHeader)))
            {
                ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
                await ctx.Response.WriteAsJsonAsync(new { message = "CSRF validation failed" });
                return;
            }
        }
    }

    await next();
});

app.UseAuthorization();

// Migrations at startup. Convenient for dev and single-instance deploys; with more than
// one API instance this races, so set Database__MigrateOnStartup=false in that case and
// run migrations as a one-off step before rolling out.
if (app.Configuration.GetValue("Database:MigrateOnStartup", true))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<UsersDbContext>().Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<CatalogDbContext>().Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<OrdersDbContext>().Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<ContentDbContext>().Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<Infrastructure.Cart.CartDbContext>().Database.MigrateAsync();
}

// ---------------- Endpoints ----------------
// Controllers migrated from minimal APIs (layered refactor).
app.MapControllers();

// Dev-only seed/reset endpoints
if (app.Environment.IsDevelopment())
{
    app.MapDevSeed();
    app.MapBulkSeed();
}

// Auth endpoints: login, register, refresh, logout, email verification,
// password reset, and the optional Google OAuth flow.
app.MapAuthEndpoints(app.Environment, googleEnabled);

// debug
app.MapGet("/api/debug/me", (HttpContext ctx) =>
{
    var u = ctx.User;
    return Results.Ok(new
    {
        isAuthenticated = u?.Identity?.IsAuthenticated ?? false,
        claims = u?.Claims.Select(c => new { c.Type, c.Value })
    });
}).RequireAuthorization();

// Liveness: is the process up? No dependencies — a failing database must not cause the
// orchestrator to kill and restart an otherwise healthy container.
app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();

// Readiness: should this instance receive traffic? Only "ready"-tagged dependencies count.
// Anonymous, because the platform's readiness probe carries no credentials, so it must not
// return exception text. A failed SQL connection message can name servers and databases.
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = c => c.Tags.Contains("ready"),
    ResponseWriter = (ctx, report) => WriteHealthJson(ctx, report, includeErrors: false)
}).AllowAnonymous();

// Everything, including non-gating checks like Redis, WITH error messages. For a human
// debugging, so it requires an admin. Today this path is not routed publicly at all (nginx
// only forwards /api/*), but relying on routing alone means one proxy change would expose it.
app.MapHealthChecks("/health/details", new HealthCheckOptions
{
    ResponseWriter = (ctx, report) => WriteHealthJson(ctx, report, includeErrors: true)
}).RequireAuthorization("role:admin");

static Task WriteHealthJson(HttpContext ctx, HealthReport report, bool includeErrors)
{
    ctx.Response.ContentType = "application/json";
    return ctx.Response.WriteAsJsonAsync(new
    {
        status = report.Status.ToString(),
        totalDurationMs = report.TotalDuration.TotalMilliseconds,
        checks = report.Entries.Select(e => new
        {
            name = e.Key,
            status = e.Value.Status.ToString(),
            durationMs = e.Value.Duration.TotalMilliseconds,
            description = e.Value.Description,
            error = includeErrors ? e.Value.Exception?.Message : null,
            tags = e.Value.Tags,
        })
    });
}

app.MapFallbackToFile("index.html");

app.Run();

}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

public record LoginRequest(string Email, string Password);
public record RegisterRequest(string Email, string Password);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);

// Exposes the top-level Program class to the integration test host (WebApplicationFactory<Program>).
public partial class Program { }
