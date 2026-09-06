using Amazon.S3;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Api.Observability;

// Uploads and lesson media are unusable if object storage is unreachable, so readiness
// covers it. The probe is a metadata call on the bucket rather than a read or write:
// it proves credentials, network, and bucket existence without touching any object.
public sealed class StorageHealthCheck(IAmazonS3 s3, IConfiguration cfg) : IHealthCheck
{
    private readonly string _bucket = cfg["Storage:S3:AssetBucket"] ?? "km-assets";

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            await s3.GetBucketLocationAsync(_bucket, ct);
            return HealthCheckResult.Healthy($"Bucket '{_bucket}' reachable.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy($"Bucket '{_bucket}' unreachable.", ex);
        }
    }
}
