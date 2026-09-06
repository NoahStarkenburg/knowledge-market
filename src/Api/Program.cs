using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Amazon.S3;
using Api.Authorization;
using Api.Authorization.AccessService;
using Api.Authorization.Handlers;
using Api.Authorization.Policies;
using Api.Configuration;
using Api.ContentStorage;
using Api.DataSeeding;
using Api.Email;
using Api.Endpoints;
using Api.Payments;
using Api.Storage;
using Infrastructure.Catalog;
using Infrastructure.Content;
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
using Api.Observability;
using Application.Common;
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

// OpenTelemetry: distributed traces + application/runtime metrics, exported over OTLP
// to the collector (Grafana Tempo/Prometheus) when an endpoint is configured. The
// exporter reads OTEL_EXPORTER_OTLP_ENDPOINT / OTEL_EXPORTER_OTLP_PROTOCOL from env.
var otlpEndpoint = builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"];
if (!string.IsNullOrWhiteSpace(otlpEndpoint))
{
    builder.Services.AddOpenTelemetry()
        .ConfigureResource(r => r
            .AddService(serviceName: ObservabilityDefaults.ServiceName, serviceVersion: ObservabilityDefaults.ServiceVersion)
            .AddAttributes(new Dictionary<string, object>
            {
                // Lets one Grafana stack tell Docker apart from Production, and one replica
                // apart from another, without a separate datasource per environment.
                ["deployment.environment"] = builder.Environment.EnvironmentName,
                ["service.instance.id"] = Environment.MachineName,
            }))
        .WithTracing(t => t
            .AddAspNetCoreInstrumentation(o =>
            {
                // Container probes hit /health every 30s. Left in, they bury real requests
                // in Tempo and skew every span-metric derived from the trace stream.
                o.Filter = ctx => !ObservabilityDefaults.IsProbePath(ctx.Request.Path);
                o.RecordException = true;
            })
            .AddHttpClientInstrumentation()
            .AddSqlClientInstrumentation()          // a span per SQL query
            .AddSource(AppDiagnostics.SourceName)   // our business spans (purchase, checkout, cache)
            .AddOtlpExporter())
        .WithMetrics(m => m
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddRuntimeInstrumentation()
            .AddSqlClientInstrumentation()          // DB command duration metrics
            .AddMeter(AppMetrics.MeterName)         // our business metrics
            .AddOtlpExporter());
}

// Business metrics (signups, logins, orders, payments, cache) on the KnowledgeMarket meter.
builder.Services.AddSingleton<AppMetrics>();

// ---------------- Services ----------------

// EF Core (SQL Server) — one database, a schema per bounded context, and a
// separate __EFMigrationsHistory table inside each so contexts migrate independently.
builder.Services.AddDbContext<UsersDbContext>(opt =>
{
    var conn = builder.Configuration.GetConnectionString("Default");
    opt.UseSqlServer(conn, b => b.MigrationsHistoryTable("__EFMigrationsHistory", "identity"));
});
builder.Services.AddDbContext<CatalogDbContext>(opt =>
{
    var conn = builder.Configuration.GetConnectionString("Default");
    opt.UseSqlServer(conn, b => b.MigrationsHistoryTable("__EFMigrationsHistory", "catalog"));
});
builder.Services.AddDbContext<OrdersDbContext>(opt =>
{
    var conn = builder.Configuration.GetConnectionString("Default");
    opt.UseSqlServer(conn, b => b.MigrationsHistoryTable("__EFMigrationsHistory", "orders"));
});
builder.Services.AddDbContext<ContentDbContext>(opt =>
{
    var conn = builder.Configuration.GetConnectionString("Default");
    opt.UseSqlServer(conn, b => b.MigrationsHistoryTable("__EFMigrationsHistory", "content"));
});
builder.Services.AddDbContext<Infrastructure.Cart.CartDbContext>(opt =>
{
    var conn = builder.Configuration.GetConnectionString("Default");
    opt.UseSqlServer(conn, b => b.MigrationsHistoryTable("__EFMigrationsHistory", "carts"));
});

// Distributed cache (Redis). Optional: when Redis:ConnectionString is set we wire the real
// Redis-backed cache; otherwise a no-op store keeps the app running unchanged without Redis.
var redisConnection = builder.Configuration["Redis:ConnectionString"];
if (!string.IsNullOrWhiteSpace(redisConnection))
{
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = redisConnection;
        options.InstanceName = "km:"; // key prefix, so this app's keys are easy to spot in redis-cli
    });
    builder.Services.AddSingleton<Application.Abstractions.ICacheStore, Api.Caching.RedisCacheStore>();
}
else
{
    builder.Services.AddSingleton<Application.Abstractions.ICacheStore, Api.Caching.NullCacheStore>();
}

// Single-flight coalescer for cache rebuilds. Singleton so its in-flight table is shared across
// concurrent requests (that sharing is what collapses a stampede into one rebuild).
builder.Services.AddSingleton<Application.Common.SingleFlight>();

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

    builder.Services.AddScoped<Application.Abstractions.IStorage, S3Storage>();
    builder.Services.AddSingleton<Application.Abstractions.IContentStorage, S3ContentStorage>();
    builder.Services.AddHostedService<S3BucketInitializer>();
}
else
{
    builder.Services.AddSingleton<Application.Abstractions.IContentStorage, LocalContentStorage>();
    builder.Services.AddScoped<Application.Abstractions.IStorage, LocalStorage>();
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

// CORS — in dev allow any localhost port so Vite can use whatever port is free
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.SetIsOriginAllowed(origin =>
            {
                if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
                // Allow any localhost port in development; restrict to configured origins otherwise.
                if (builder.Environment.IsDevelopment() && (uri.Host == "localhost" || uri.Host == "127.0.0.1")) return true;
                // Cors:FrontendOrigin may list several origins (comma-separated) so both the
                // React and Angular frontends can share one backend.
                var configured = builder.Configuration["Cors:FrontendOrigin"];
                return configured is not null && configured
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Any(o => origin.Equals(o, StringComparison.OrdinalIgnoreCase));
            })
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

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

var redisConn = builder.Configuration["Redis:ConnectionString"];
if (!string.IsNullOrWhiteSpace(redisConn))
{
    healthChecks.AddRedis(redisConn, name: "redis", tags: ["cache"]);
}

if (string.Equals(builder.Configuration["Storage:Provider"], "s3", StringComparison.OrdinalIgnoreCase))
{
    healthChecks.AddCheck<Api.Observability.StorageHealthCheck>("storage", tags: ["storage", "ready"]);
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

app.UseCors();
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
app.UseRateLimiter();

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
                csrfCookie != csrfHeader)
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

// Auth endpoints: login issues cookie JWT + CSRF cookie
var auth = app.MapGroup("/api/auth").WithTags("Auth");

auth.MapPost("/login", async (
    [FromBody] LoginRequest req,
    HttpContext http,
    UsersDbContext db,
    ITokenService tokens,
    AppMetrics metrics,
    CancellationToken ct) =>
{
    string emailValue;
    try { emailValue = Domain.Identity.Email.Create(req.Email).Value; }
    catch { return Results.Unauthorized(); }

    var user = await db.Users
        .Include(u => u.Roles)
        .FirstOrDefaultAsync(u => u.Email.Value == emailValue, ct);

    // Don't reveal whether the email exists
    if (user is null)
    {
        Log.Warning("Login failed for {Email}", LogSanitizer.MaskEmail(req.Email));
        return Results.Unauthorized();
    }

    if (user.IsLockedOut)
    {
        Log.Warning("Login blocked (locked out) for user {UserId}", user.Id);
        return Results.Json(
            new { message = "Account temporarily locked after too many failed attempts. Try again in a few minutes." },
            statusCode: StatusCodes.Status429TooManyRequests);
    }

    if (!user.VerifyPassword(req.Password))
    {
        user.RegisterFailedLogin();
        await db.SaveChangesAsync(ct);
        metrics.RecordLogin(false);
        Log.Warning("Login failed for {Email}", LogSanitizer.MaskEmail(req.Email));
        return Results.Unauthorized();
    }

    user.RegisterSuccessfulLogin();
    await db.SaveChangesAsync(ct);
    metrics.RecordLogin(true);

    Log.Information("Login succeeded for user {UserId}", user.Id);

    var roles = user.Roles.Select(r => r.Name).ToList();
    var accessToken = await tokens.Create(user.Id, user.Email.Value);
    var refreshToken = await tokens.CreateRefreshTokenAsync(user.Id, ct);

    http.Response.Cookies.Append(AuthCookies.AccessTokenCookie, accessToken,
        CookieHelpers.Auth(app.Environment, TimeSpan.FromMinutes(15)));

    http.Response.Cookies.Append(AuthCookies.RefreshTokenCookie, refreshToken,
        CookieHelpers.Auth(app.Environment, TimeSpan.FromDays(7), path: "/api/auth"));

    var csrfBytes = RandomNumberGenerator.GetBytes(32);
    var csrf = Microsoft.IdentityModel.Tokens.Base64UrlEncoder.Encode(csrfBytes);

    http.Response.Cookies.Append(AuthCookies.CsrfCookie, csrf,
        CookieHelpers.Csrf(app.Environment, TimeSpan.FromDays(7)));

    return Results.Ok(new { userId = user.Id, email = user.Email.Value, csrf, isEmailVerified = user.IsEmailVerified, roles, displayName = user.DisplayName });
})
.AllowAnonymous()
.RequireRateLimiting("login");

// Google OAuth: /start redirects to Google; Google returns to /signin-google (handled by the
// middleware) which redirects to /callback, where we find-or-create the user and issue our own
// cookies. Only mapped when Google is configured.
if (googleEnabled)
{
    auth.MapGet("/google/start", (HttpContext http) =>
        Results.Challenge(
            new AuthenticationProperties { RedirectUri = "/api/auth/google/callback" },
            new[] { "Google" }))
    .AllowAnonymous();

    auth.MapGet("/google/callback", async (
        HttpContext http,
        UsersDbContext db,
        ITokenService tokens,
        IConfiguration cfg,
        CancellationToken ct) =>
    {
        var frontendUrl = cfg["Cors:FrontendOrigin"] ?? "http://localhost:5173";

        var result = await http.AuthenticateAsync("External");
        if (!result.Succeeded || result.Principal is null)
            return Results.Redirect($"{frontendUrl}/login?error=google");

        var email = result.Principal.FindFirstValue(ClaimTypes.Email);
        var subject = result.Principal.FindFirstValue(ClaimTypes.NameIdentifier);
        var name = result.Principal.FindFirstValue(ClaimTypes.Name);
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(subject))
            return Results.Redirect($"{frontendUrl}/login?error=google");

        string emailValue;
        try { emailValue = Domain.Identity.Email.Create(email).Value; }
        catch { return Results.Redirect($"{frontendUrl}/login?error=google"); }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email.Value == emailValue, ct);
        if (user is null)
        {
            user = Domain.Identity.User.RegisterExternal(emailValue, "google", subject);
            if (!string.IsNullOrWhiteSpace(name) && name.Length <= 100) user.SetDisplayName(name);
            db.Users.Add(user);
        }
        else if (user.ExternalId is null)
        {
            user.LinkExternal("google", subject);
        }
        await db.SaveChangesAsync(ct);

        await http.SignOutAsync("External");

        var accessToken = await tokens.Create(user.Id, user.Email.Value);
        var refreshToken = await tokens.CreateRefreshTokenAsync(user.Id, ct);

        http.Response.Cookies.Append(AuthCookies.AccessTokenCookie, accessToken,
            CookieHelpers.Auth(app.Environment, TimeSpan.FromMinutes(15)));
        http.Response.Cookies.Append(AuthCookies.RefreshTokenCookie, refreshToken,
            CookieHelpers.Auth(app.Environment, TimeSpan.FromDays(7), path: "/api/auth"));

        var csrfBytes = RandomNumberGenerator.GetBytes(32);
        var csrf = Microsoft.IdentityModel.Tokens.Base64UrlEncoder.Encode(csrfBytes);
        http.Response.Cookies.Append(AuthCookies.CsrfCookie, csrf,
            CookieHelpers.Csrf(app.Environment, TimeSpan.FromDays(7)));

        return Results.Redirect($"{frontendUrl}/auth/callback");
    })
    .AllowAnonymous();
}

auth.MapPost("/register", async (
    [FromBody] RegisterRequest req,
    HttpContext http,
    UsersDbContext db,
    ITokenService tokens,
    IEmailService emailSvc,
    IConfiguration cfg,
    AppMetrics metrics,
    CancellationToken ct) =>
{
    string emailValue;
    try { emailValue = Domain.Identity.Email.Create(req.Email).Value; }
    catch { return Results.BadRequest(new { message = "Invalid email address." }); }

    var exists = await db.Users.AnyAsync(u => u.Email.Value == emailValue, ct);
    if (exists)
        return Results.Conflict(new { message = "An account with that email already exists." });

    var user = Domain.Identity.User.Register(emailValue, req.Password);
    db.Users.Add(user);
    await db.SaveChangesAsync(ct);
    metrics.RecordRegistration();

    Log.Information("User registered {UserId} {Email}", user.Id, LogSanitizer.MaskEmail(emailValue));

    // Send verification email (fire-and-forget — don't fail registration if email fails)
    var frontendUrl = cfg["Cors:FrontendOrigin"] ?? "http://localhost:5173";
    var verifyUrl = $"{http.Request.Scheme}://{http.Request.Host}/api/auth/verify-email?token={Uri.EscapeDataString(user.VerificationToken!)}";
    _ = emailSvc.SendAsync(user.Email.Value, "Verify your KnowledgeMarket email",
        EmailTemplates.VerifyEmail(verifyUrl), ct);

    // Issue tokens so user is immediately logged in
    var accessToken = await tokens.Create(user.Id, user.Email.Value);
    var refreshToken = await tokens.CreateRefreshTokenAsync(user.Id, ct);

    http.Response.Cookies.Append(AuthCookies.AccessTokenCookie, accessToken,
        CookieHelpers.Auth(app.Environment, TimeSpan.FromMinutes(15)));

    http.Response.Cookies.Append(AuthCookies.RefreshTokenCookie, refreshToken,
        CookieHelpers.Auth(app.Environment, TimeSpan.FromDays(7), path: "/api/auth"));

    var csrfBytes = RandomNumberGenerator.GetBytes(32);
    var csrf = Microsoft.IdentityModel.Tokens.Base64UrlEncoder.Encode(csrfBytes);
    http.Response.Cookies.Append(AuthCookies.CsrfCookie, csrf,
        CookieHelpers.Csrf(app.Environment, TimeSpan.FromDays(7)));

    return Results.Ok(new { userId = user.Id, email = user.Email.Value, csrf });
})
.AllowAnonymous()
.RequireRateLimiting("register");

auth.MapPost("/refresh", async (
    HttpContext http,
    ITokenService tokens,
    UsersDbContext db,
    CancellationToken ct) =>
{
    var rawRefreshToken = http.Request.Cookies[AuthCookies.RefreshTokenCookie];
    if (string.IsNullOrWhiteSpace(rawRefreshToken))
        return Results.Unauthorized();

    var result = await tokens.RotateRefreshTokenAsync(rawRefreshToken, ct);
    if (result is null)
        return Results.Unauthorized();

    var (userId, newRefreshToken) = result.Value;

    var userEmail = await db.Users.AsNoTracking()
        .Where(u => u.Id == userId)
        .Select(u => u.Email.Value)
        .FirstOrDefaultAsync(ct);

    if (userEmail is null) return Results.Unauthorized();

    var newAccessToken = await tokens.Create(userId, userEmail);

    http.Response.Cookies.Append(AuthCookies.AccessTokenCookie, newAccessToken,
        CookieHelpers.Auth(app.Environment, TimeSpan.FromMinutes(15)));

    http.Response.Cookies.Append(AuthCookies.RefreshTokenCookie, newRefreshToken,
        CookieHelpers.Auth(app.Environment, TimeSpan.FromDays(7), path: "/api/auth"));

    return Results.Ok(new { ok = true });
})
.AllowAnonymous();

auth.MapPost("/logout", async (HttpContext http, ITokenService tokens, CancellationToken ct) =>
{
    var rawRefreshToken = http.Request.Cookies[AuthCookies.RefreshTokenCookie];
    if (!string.IsNullOrWhiteSpace(rawRefreshToken))
        await tokens.RevokeRefreshTokenAsync(rawRefreshToken, ct);

    http.Response.Cookies.Delete(AuthCookies.AccessTokenCookie, CookieHelpers.Delete(app.Environment));
    http.Response.Cookies.Delete(AuthCookies.RefreshTokenCookie, CookieHelpers.Delete(app.Environment, path: "/api/auth"));
    http.Response.Cookies.Delete(AuthCookies.CsrfCookie, CookieHelpers.Delete(app.Environment));
    return Results.Ok(new { ok = true });
})
.AllowAnonymous();

auth.MapGet("/verify-email", async (
    [FromQuery] string token,
    UsersDbContext db,
    IConfiguration cfg,
    CancellationToken ct) =>
{
    var frontendUrl = cfg["Cors:FrontendOrigin"] ?? "http://localhost:5173";

    if (string.IsNullOrWhiteSpace(token))
        return Results.Redirect($"{frontendUrl}/verify-email?error=invalid");

    var user = await db.Users
        .FirstOrDefaultAsync(u => u.VerificationToken == token, ct);

    if (user is null)
        return Results.Redirect($"{frontendUrl}/verify-email?error=invalid");

    if (!user.VerifyEmail(token))
        return Results.Redirect($"{frontendUrl}/verify-email?error=expired");

    await db.SaveChangesAsync(ct);
    return Results.Redirect($"{frontendUrl}/verify-email?success=true");
})
.AllowAnonymous();

auth.MapPost("/resend-verification", async (
    HttpContext http,
    UsersDbContext db,
    IEmailService email,
    ICurrentUser me,
    IConfiguration cfg,
    CancellationToken ct) =>
{
    var userId = await me.GetRequiredUserIdAsync(ct);
    if (userId == Guid.Empty) return Results.Unauthorized();

    var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
    if (user is null) return Results.Unauthorized();
    if (user.IsEmailVerified) return Results.BadRequest(new { message = "Email already verified." });

    user.RegenerateVerificationToken();
    await db.SaveChangesAsync(ct);

    var frontendUrl = cfg["Cors:FrontendOrigin"] ?? "http://localhost:5173";
    var verifyUrl = $"{frontendUrl}/verify-email?token={Uri.EscapeDataString(user.VerificationToken!)}";
    _ = email.SendAsync(user.Email.Value, "Verify your KnowledgeMarket email",
        EmailTemplates.VerifyEmail(verifyUrl), ct);

    return Results.Ok(new { ok = true });
})
.RequireAuthorization();

auth.MapPost("/forgot-password", async (
    [FromBody] ForgotPasswordRequest req,
    UsersDbContext db,
    IEmailService emailSvc,
    IConfiguration cfg,
    CancellationToken ct) =>
{
    // Always return 200 — never reveal whether the email exists
    if (!string.IsNullOrWhiteSpace(req.Email))
    {
        string emailValue;
        try { emailValue = Domain.Identity.Email.Create(req.Email).Value; }
        catch { return Results.Ok(new { ok = true }); }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email.Value == emailValue, ct);
        if (user is not null)
        {
            var rawResetToken = user.RequestPasswordReset();
            await db.SaveChangesAsync(ct);

            Log.Information("Password reset requested for user {UserId}", user.Id);

            var frontendUrl = cfg["Cors:FrontendOrigin"] ?? "http://localhost:5173";
            var resetUrl = $"{frontendUrl}/reset-password?token={Uri.EscapeDataString(rawResetToken)}";
            _ = emailSvc.SendAsync(user.Email.Value, "Reset your KnowledgeMarket password",
                EmailTemplates.PasswordReset(resetUrl), ct);
        }
    }
    return Results.Ok(new { ok = true });
})
.AllowAnonymous()
.RequireRateLimiting("register");

auth.MapPost("/reset-password", async (
    [FromBody] ResetPasswordRequest req,
    UsersDbContext db,
    CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(req.Token) || string.IsNullOrWhiteSpace(req.NewPassword))
        return Results.BadRequest(new { message = "Token and new password are required." });

    if (req.NewPassword.Length < 8)
        return Results.BadRequest(new { message = "Password must be at least 8 characters." });

    var tokenHash = Domain.Identity.User.HashToken(req.Token);
    var user = await db.Users.FirstOrDefaultAsync(u => u.PasswordResetToken == tokenHash, ct);
    if (user is null)
        return Results.BadRequest(new { message = "Link expired or invalid." });

    if (!user.ResetPassword(req.Token, req.NewPassword))
        return Results.BadRequest(new { message = "Link expired or invalid." });

    await db.SaveChangesAsync(ct);
    return Results.Ok(new { ok = true });
})
.AllowAnonymous();

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
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = c => c.Tags.Contains("ready"),
    ResponseWriter = WriteHealthJson
}).AllowAnonymous();

// Everything, including non-gating checks like Redis. For humans and dashboards.
app.MapHealthChecks("/health/details", new HealthCheckOptions { ResponseWriter = WriteHealthJson })
    .AllowAnonymous();

static Task WriteHealthJson(HttpContext ctx, HealthReport report)
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
            error = e.Value.Exception?.Message,
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
