using Azure.Identity;
using Microsoft.Extensions.Configuration;
using StackExchange.Redis;

namespace Infrastructure.Caching;

// Opens the one Redis connection the app shares, or returns null when Redis is not configured.
//
//   Redis:ConnectionString   a local Redis ("redis:6379"), connected to as written
//   Redis:Host               Azure Managed Redis ("<name>.<region>.redis.azure.net:10000"), with no
//                            password: the app signs in with its managed identity through Entra ID
//
// StackExchange.Redis is built around a single long-lived, thread-safe connection per process, so
// the cache and its health check both use this one rather than opening their own.
public static class RedisConnectionFactory
{
    public static async Task<IConnectionMultiplexer?> ConnectAsync(IConfiguration cfg)
    {
        var host = cfg["Redis:Host"];
        var connectionString = cfg["Redis:ConnectionString"];

        ConfigurationOptions options;
        if (!string.IsNullOrWhiteSpace(host))
        {
            options = ConfigurationOptions.Parse(host);
            // Azure Managed Redis accepts TLS connections only.
            options.Ssl = true;
            // Gets an Entra ID token for the managed identity (AZURE_CLIENT_ID picks which one), sends
            // the identity's object id as the Redis user name and the token as its password, and
            // re-authenticates the connection with a fresh token before each one expires.
            await options.ConfigureForAzureWithTokenCredentialAsync(new DefaultAzureCredential());
        }
        else if (!string.IsNullOrWhiteSpace(connectionString))
        {
            options = ConfigurationOptions.Parse(connectionString);
        }
        else
        {
            return null;
        }

        // Start even when Redis is unreachable and keep reconnecting in the background. The cache is
        // an optimisation: while Redis is down every read is a miss, never a failed request.
        options.AbortOnConnectFail = false;
        // While disconnected, fail each command at once. The default queues commands until the
        // connection returns or they time out, which during an outage added about 18 seconds to a
        // request that touches the cache: slower in theory, broken in practice.
        options.BacklogPolicy = BacklogPolicy.FailFast;
        return await ConnectionMultiplexer.ConnectAsync(options);
    }
}
