using System.Collections.Concurrent;

namespace Shared.Kernel;

// In-process request coalescing ("single flight"). Concurrent callers asking for the same key share
// ONE execution of the factory instead of each running it. Placed in front of a cache-aside reload,
// it means that when a hot key expires, the burst of simultaneous misses triggers a single rebuild
// (one DB query) rather than a stampede. Coalescing is per process: with N API instances you get at
// most N concurrent rebuilds, not N x requests. Registered as a singleton so the in-flight table is
// shared across requests.
//
// Note: waiters share the leader's execution, so if the leader's request is cancelled the shared
// task is cancelled for everyone. Acceptable here because the coalesced work (a fast aggregate) is
// short-lived; for long reloads you would run the factory under a detached CancellationToken.
public sealed class SingleFlight
{
    private readonly ConcurrentDictionary<string, Lazy<Task<object?>>> _calls = new();

    public async Task<T?> RunAsync<T>(string key, Func<Task<T?>> factory) where T : class
    {
        // Lazy(ExecutionAndPublication) guarantees the inner Task is created exactly once even if
        // several threads race through GetOrAdd, so the factory runs a single time per key.
        var lazy = _calls.GetOrAdd(key, _ =>
            new Lazy<Task<object?>>(async () => await factory(), LazyThreadSafetyMode.ExecutionAndPublication));
        try
        {
            return (T?)await lazy.Value;
        }
        finally
        {
            // Remove only if this exact entry is still current, so a fresh in-flight call started by
            // a later burst is not evicted. Single-flight dedupes concurrency; caching is the cache's
            // job, so once this batch completes the key is cleared and the next miss reloads.
            _calls.TryRemove(new KeyValuePair<string, Lazy<Task<object?>>>(key, lazy));
        }
    }
}
