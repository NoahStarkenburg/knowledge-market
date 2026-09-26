using Application.Abstractions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Testcontainers.MsSql;

namespace IntegrationTests;

// Boots the real API against a throwaway SQL Server container. External payment calls and
// outgoing email are replaced with fakes; everything else (auth, EF, migrations, CSRF) is real.
// Requires Docker to be running.
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly MsSqlContainer _db = new MsSqlBuilder()
        .WithImage("mcr.microsoft.com/mssql/server:2022-latest")
        .Build();

    public RecordingEmailService Emails { get; } = new();

    public async Task InitializeAsync()
    {
        await _db.StartAsync();

        // Program's config chain ends with AddEnvironmentVariables(), so env vars beat every
        // appsettings file. This is the reliable way to point the host at the test container.
        Environment.SetEnvironmentVariable("ConnectionStrings__Default", _db.GetConnectionString());
        Environment.SetEnvironmentVariable("Jwt__Issuer", "km-tests");
        Environment.SetEnvironmentVariable("Jwt__Audience", "km-tests");
        Environment.SetEnvironmentVariable("Jwt__SigningKey", "test-signing-key-that-is-at-least-32-bytes-long");
        Environment.SetEnvironmentVariable("Admin__Email", "admin@tests.local");
        Environment.SetEnvironmentVariable("Admin__Password", "AdminTests12345!");
        Environment.SetEnvironmentVariable("Storage__Provider", "local");
        Environment.SetEnvironmentVariable("Email__Provider", "null");
        // A non-placeholder price id lets the subscribe path run against the fake payment service.
        Environment.SetEnvironmentVariable("Stripe__SubscriptionPriceId", "price_test_fake");
        Environment.SetEnvironmentVariable("Stripe__WebhookSecret", "whsec_test_fake");
        Environment.SetEnvironmentVariable("Database__MigrateOnStartup", "true");
        Environment.SetEnvironmentVariable("RateLimiting__Enabled", "false");
        Environment.SetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT", "");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IPaymentService>();
            services.AddScoped<IPaymentService, FakePaymentService>();
            services.RemoveAll<IEmailService>();
            services.AddSingleton<IEmailService>(Emails);
        });
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await _db.DisposeAsync();
        await base.DisposeAsync();
    }
}

[CollectionDefinition("api")]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>;
