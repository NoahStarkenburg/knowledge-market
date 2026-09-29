using Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Api.Authorization;

// Runs once at startup then every 24 hours.
// Deletes refresh tokens that expired more than 24 hours ago - keeps the
// table small without removing tokens that are still technically "just expired"
// (in case of clock skew or pending in-flight requests).
public sealed class RefreshTokenCleanupService(
    IServiceProvider services,
    ILogger<RefreshTokenCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval  = TimeSpan.FromHours(24);
    private static readonly TimeSpan GracePeriod = TimeSpan.FromHours(24);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CleanupAsync(stoppingToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogError(ex, "Refresh token cleanup failed.");
                }

                await Task.Delay(Interval, stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            // Expected: the host is shutting down and cancelled stoppingToken.
            // Letting it escape would fault the BackgroundService, which under the
            // default BackgroundServiceExceptionBehavior.StopHost logs a fatal error
            // on every normal shutdown.
        }
    }

    private async Task CleanupAsync(CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<UsersDbContext>();

        var cutoff = DateTimeOffset.UtcNow - GracePeriod;

        var deleted = await db.RefreshTokens
            .Where(t => t.ExpiresAt < cutoff)
            .ExecuteDeleteAsync(ct);

        if (deleted > 0)
            logger.LogInformation("Deleted {Count} expired refresh tokens.", deleted);
    }
}
