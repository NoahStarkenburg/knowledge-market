using Azure.Storage.Blobs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Infrastructure.Storage;

// The Azure Blob counterpart of StorageHealthCheck. Reading the container's properties proves the
// endpoint is reachable, the identity can authenticate and has access, and the container exists,
// without reading or writing any file.
public sealed class AzureBlobHealthCheck(BlobServiceClient service, IConfiguration cfg) : IHealthCheck
{
    private readonly string _container = cfg["Storage:AzureBlob:AssetContainer"] ?? "assets";

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            await service.GetBlobContainerClient(_container).GetPropertiesAsync(cancellationToken: ct);
            return HealthCheckResult.Healthy($"Container '{_container}' reachable.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy($"Container '{_container}' unreachable.", ex);
        }
    }
}
