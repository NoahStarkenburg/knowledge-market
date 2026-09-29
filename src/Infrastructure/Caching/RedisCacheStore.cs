using Microsoft.Extensions.Logging;
using System.Text.Json;
using Application.Abstractions;
using Shared.Abstractions;
using Shared.Kernel;
using Microsoft.Extensions.Caching.Distributed;

namespace Infrastructure.Caching;

// Redis-backed ICacheStore. Values are stored as UTF-8 JSON with an absolute TTL. Every operation
// is wrapped so a Redis outage degrades to a cache miss (reads) or a no-op (writes/invalidation)
// instead of failing the request. The trade-off: if a RemoveAsync silently fails during an outage,
// a stale entry survives until its TTL expires - which is why every cached read still carries one.
//
// Reads are counted (hit/miss/error) and traced, because a cache that silently stops hitting looks
// exactly like a cache that is working - only slower.
public sealed class RedisCacheStore(IDistributedCache cache, AppMetrics metrics, ILogger<RedisCacheStore> log) : ICacheStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    // Keys look like "course:v1:{id}" - the leading segment groups them so one hot key
    // can't mask a cold one in the hit-rate panel.
    private static string RegionOf(string key)
    {
        var i = key.IndexOf(':');
        return i <= 0 ? "other" : key[..i];
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct) where T : class
    {
        var region = RegionOf(key);
        using var activity = AppDiagnostics.Start("cache.get");
        activity?.SetTag("cache.system", "redis");
        activity?.SetTag("cache.region", region);

        try
        {
            var bytes = await cache.GetAsync(key, ct);
            var hit = bytes is not null;

            activity?.SetTag("cache.hit", hit);
            metrics.RecordCacheRequest(region, hit ? "hit" : "miss");

            return hit ? JsonSerializer.Deserialize<T>(bytes!, JsonOptions) : null;
        }
        catch (Exception ex)
        {
            activity?.SetTag("cache.hit", false);
            activity?.SetTag("error", true);
            metrics.RecordCacheRequest(region, "error");
            log.LogWarning(ex, "Cache GET failed for {Key}; serving from source", key);
            return null;
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct) where T : class
    {
        try
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(value, JsonOptions);
            await cache.SetAsync(key, bytes, new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl }, ct);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Cache SET failed for {Key}; skipping", key);
        }
    }

    public async Task RemoveAsync(string key, CancellationToken ct)
    {
        try
        {
            await cache.RemoveAsync(key, ct);
            log.LogDebug("Cache entry {Key} invalidated", key);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Cache invalidation failed for {Key}; entry will expire on its TTL", key);
        }
    }
}
