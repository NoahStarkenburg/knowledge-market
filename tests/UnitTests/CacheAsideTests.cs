using System.Collections.Concurrent;
using Application.Abstractions;

namespace UnitTests;

// Exercises the cache-aside contract that CourseService relies on, using an in-memory ICacheStore.
public class CacheAsideTests
{
    private sealed record Box(string Value);

    // Minimal in-memory ICacheStore that also counts sets, so tests can assert what was cached.
    private sealed class FakeCache : ICacheStore
    {
        private readonly ConcurrentDictionary<string, object> _store = new();
        public int Sets { get; private set; }

        public Task<T?> GetAsync<T>(string key, CancellationToken ct) where T : class =>
            Task.FromResult(_store.TryGetValue(key, out var v) ? (T?)v : null);

        public Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct) where T : class
        {
            _store[key] = value;
            Sets++;
            return Task.CompletedTask;
        }

        public Task RemoveAsync(string key, CancellationToken ct)
        {
            _store.TryRemove(key, out _);
            return Task.CompletedTask;
        }
    }

    [Fact]
    public async Task GetOrSet_miss_then_hit_loads_once_and_caches()
    {
        var cache = new FakeCache();
        var loads = 0;
        Task<Box?> Load(CancellationToken _) { loads++; return Task.FromResult<Box?>(new Box("db")); }

        var first = await cache.GetOrSetAsync("k", TimeSpan.FromMinutes(1), Load, CancellationToken.None);
        var second = await cache.GetOrSetAsync("k", TimeSpan.FromMinutes(1), Load, CancellationToken.None);

        Assert.Equal("db", first!.Value);
        Assert.Equal("db", second!.Value);
        Assert.Equal(1, loads);   // second call served from cache, loader not re-run
        Assert.Equal(1, cache.Sets);
    }

    [Fact]
    public async Task GetOrSet_does_not_cache_a_null_result()
    {
        var cache = new FakeCache();
        var loads = 0;
        Task<Box?> LoadNull(CancellationToken _) { loads++; return Task.FromResult<Box?>(null); }

        var first = await cache.GetOrSetAsync("missing", TimeSpan.FromMinutes(1), LoadNull, CancellationToken.None);
        var second = await cache.GetOrSetAsync("missing", TimeSpan.FromMinutes(1), LoadNull, CancellationToken.None);

        Assert.Null(first);
        Assert.Null(second);
        Assert.Equal(2, loads);   // no negative caching: a null is never stored, so each call reloads
        Assert.Equal(0, cache.Sets);
    }

    [Fact]
    public async Task Remove_evicts_so_the_next_read_reloads()
    {
        var cache = new FakeCache();
        var loads = 0;
        Task<Box?> Load(CancellationToken _) { loads++; return Task.FromResult<Box?>(new Box($"v{loads}")); }

        var first = await cache.GetOrSetAsync("k", TimeSpan.FromMinutes(1), Load, CancellationToken.None);
        await cache.RemoveAsync("k", CancellationToken.None);
        var second = await cache.GetOrSetAsync("k", TimeSpan.FromMinutes(1), Load, CancellationToken.None);

        Assert.Equal("v1", first!.Value);
        Assert.Equal("v2", second!.Value);   // reloaded after invalidation
        Assert.Equal(2, loads);
    }
}
