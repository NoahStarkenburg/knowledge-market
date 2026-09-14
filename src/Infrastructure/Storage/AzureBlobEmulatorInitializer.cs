using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Storage;

// Prepares Azurite, the local emulator, which starts out empty. Registered only when the app is
// configured with a connection string, which means Azurite.
//
// In Azure this class does not run. The containers and the CORS rule are infrastructure, created
// by Terraform, and the app's managed identity is only granted access to read and write blobs.
public sealed class AzureBlobEmulatorInitializer(
    BlobServiceClient service,
    IConfiguration cfg,
    ILogger<AzureBlobEmulatorInitializer> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken ct)
    {
        foreach (var name in new[]
        {
            cfg["Storage:AzureBlob:AssetContainer"] ?? "assets",
            cfg["Storage:AzureBlob:ContentContainer"] ?? "content",
        })
        {
            // PublicAccessType.None is the default, stated anyway: nothing in these containers is
            // readable without a SAS URL.
            await service.GetBlobContainerClient(name).CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: ct);
        }

        // The direct upload is a PUT from the page's origin to the storage origin, a different one,
        // so the browser first sends a CORS preflight and only proceeds if storage allows it.
        // Downloads need no rule: they are redirects followed by <img>, <video> and new tabs,
        // which do not read the response from script.
        var origin = cfg["Cors:FrontendOrigin"] is { Length: > 0 } o ? o : "http://localhost:4200";

        // Read, change CORS, write the whole document back. Service properties are one document
        // (logging, metrics, CORS, ...), and Azurite rejects a write that carries only part of it.
        var properties = (await service.GetPropertiesAsync(ct)).Value;
        properties.Cors =
        [
            new BlobCorsRule
            {
                AllowedOrigins = origin,
                AllowedMethods = "PUT",
                AllowedHeaders = "content-type,x-ms-blob-type",
                ExposedHeaders = "etag",
                MaxAgeInSeconds = 3000,
            },
        ];
        await service.SetPropertiesAsync(properties, ct);

        logger.LogInformation("Azurite containers ready; uploads allowed from {Origin}", origin);
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
