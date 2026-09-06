namespace Application.Abstractions;

// Distributed cache abstraction. Implemented by the Redis adapter in the web layer, with a
// no-op fallback so the app runs unchanged when Redis is not configured. Implementations must
// treat a backing-store outage as a miss (never throw): a cache is an optimization, and losing
// it should make the app slower, not broken.
public interface ICacheStore
{
    Task<T?> GetAsync<T>(string key, CancellationToken ct) where T : class;
    Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct) where T : class;
    Task RemoveAsync(string key, CancellationToken ct);
}

public static class CacheStoreExtensions
{
    // Cache-aside: return the cached value on a hit, otherwise load it, store it, and return it.
    // Only non-null results are cached, so a null return always means "miss" (no negative caching).
    public static async Task<T?> GetOrSetAsync<T>(
        this ICacheStore cache,
        string key,
        TimeSpan ttl,
        Func<CancellationToken, Task<T?>> load,
        CancellationToken ct) where T : class
    {
        var cached = await cache.GetAsync<T>(key, ct);
        if (cached is not null) return cached;

        var value = await load(ct);
        if (value is not null) await cache.SetAsync(key, value, ttl, ct);
        return value;
    }
}
