using Application.Common;

namespace UnitTests;

public class SingleFlightTests
{
    [Fact]
    public async Task Concurrent_calls_for_the_same_key_run_the_factory_once()
    {
        var sf = new SingleFlight();
        var executions = 0;
        var gate = new TaskCompletionSource(); // holds the factory in-flight so all callers overlap

        async Task<string?> Factory()
        {
            Interlocked.Increment(ref executions);
            await gate.Task; // stay running until released
            return "value";
        }

        // Start 50 callers for the same key while the factory is still in flight.
        var calls = Enumerable.Range(0, 50).Select(_ => sf.RunAsync("k", Factory)).ToArray();
        gate.SetResult(); // release the coalesced execution
        var results = await Task.WhenAll(calls);

        Assert.All(results, r => Assert.Equal("value", r));
        Assert.Equal(1, executions); // 50 concurrent callers -> ONE factory run
    }

    [Fact]
    public async Task A_call_after_the_previous_batch_completes_runs_the_factory_again()
    {
        var sf = new SingleFlight();
        var executions = 0;
        Task<string?> Factory() { Interlocked.Increment(ref executions); return Task.FromResult<string?>("v"); }

        await sf.RunAsync("k", Factory);
        await sf.RunAsync("k", Factory); // sequential, not concurrent -> not coalesced

        Assert.Equal(2, executions); // single-flight dedupes concurrency, it does not cache
    }

    [Fact]
    public async Task Different_keys_do_not_coalesce()
    {
        var sf = new SingleFlight();
        var executions = 0;
        Task<string?> Factory() { Interlocked.Increment(ref executions); return Task.FromResult<string?>("v"); }

        await Task.WhenAll(sf.RunAsync("a", Factory), sf.RunAsync("b", Factory));

        Assert.Equal(2, executions);
    }
}
