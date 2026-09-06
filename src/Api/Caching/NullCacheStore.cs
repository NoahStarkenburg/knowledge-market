using Application.Abstractions;

namespace Api.Caching;

// Fallback used when Redis is not configured (Redis:ConnectionString empty). Every read is a miss
// and every write is a no-op, so services fall straight through to their data source. This keeps
// Redis an optional dependency: the app builds, boots, and behaves identically without it.
public sealed class NullCacheStore : ICacheStore
{
    public Task<T?> GetAsync<T>(string key, CancellationToken ct) where T : class => Task.FromResult<T?>(null);
    public Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct) where T : class => Task.CompletedTask;
    public Task RemoveAsync(string key, CancellationToken ct) => Task.CompletedTask;
}
