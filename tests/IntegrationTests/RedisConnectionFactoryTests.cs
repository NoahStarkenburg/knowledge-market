using System.Diagnostics;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Infrastructure.Caching;
using Microsoft.Extensions.Configuration;
using StackExchange.Redis;

namespace IntegrationTests;

// The connection-string path against a real Redis container. The Entra ID path (Redis:Host) needs a
// managed identity and an Azure Managed Redis instance, so it is verified after deploy.
public sealed class RedisConnectionFactoryTests : IAsyncLifetime
{
    private readonly IContainer _redis = new ContainerBuilder()
        .WithImage("redis:7.4-alpine")
        .WithPortBinding(6379, true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilMessageIsLogged("Ready to accept connections"))
        .Build();

    public Task InitializeAsync() => _redis.StartAsync();

    public Task DisposeAsync() => _redis.DisposeAsync().AsTask();

    private static IConfiguration Config(string? connectionString) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Redis:ConnectionString"] = connectionString,
        }).Build();

    [Fact]
    public async Task Returns_null_when_Redis_is_not_configured()
    {
        Assert.Null(await RedisConnectionFactory.ConnectAsync(Config(null)));
    }

    [Fact]
    public async Task Connects_with_a_connection_string()
    {
        var endpoint = $"{_redis.Hostname}:{_redis.GetMappedPublicPort(6379)}";
        using var redis = await RedisConnectionFactory.ConnectAsync(Config(endpoint));

        Assert.NotNull(redis);
        var db = redis.GetDatabase();
        await db.StringSetAsync("km:test", "cached");
        Assert.Equal("cached", (string?)await db.StringGetAsync("km:test"));
    }

    [Fact]
    public async Task Starts_when_Redis_is_unreachable_and_fails_commands_fast()
    {
        // Nothing listens on port 1. The app must still boot and treat the cache as missing.
        using var redis = await RedisConnectionFactory.ConnectAsync(Config("127.0.0.1:1,connectTimeout=500"));

        Assert.NotNull(redis);
        Assert.False(redis.IsConnected);

        // A cache read during the outage must fail immediately, so the caller falls through to the
        // database, rather than wait out a timeout on every request.
        var timer = Stopwatch.StartNew();
        await Assert.ThrowsAnyAsync<RedisException>(() => redis.GetDatabase().StringGetAsync("km:test"));
        Assert.True(timer.Elapsed < TimeSpan.FromSeconds(1), $"took {timer.Elapsed}");
    }
}
