using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Configuration;
using Shared.Abstractions;

namespace Infrastructure.Storage;

// Lesson markdown bodies, one blob per lesson. The API always reads these itself and returns
// the text as JSON, so unlike media files they never need a SAS URL.
public sealed class AzureBlobContentStorage(BlobServiceClient service, IConfiguration cfg) : IContentStorage
{
    private readonly BlobContainerClient _container =
        service.GetBlobContainerClient(cfg["Storage:AzureBlob:ContentContainer"] ?? "content");

    public async Task<string> SaveLessonBodyAsync(Guid courseId, Guid lessonId, string body, CancellationToken ct)
    {
        var key = $"{courseId:n}/{lessonId:n}.md";

        // Overwrites: saving an edited lesson replaces its previous body.
        await _container.GetBlobClient(key).UploadAsync(BinaryData.FromString(body), new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders { ContentType = "text/markdown; charset=utf-8" },
        }, ct);

        return key;
    }

    public async Task<string?> ReadLessonBodyAsync(string storagePath, CancellationToken ct)
    {
        try
        {
            var result = await _container.GetBlobClient(storagePath).DownloadContentAsync(ct);
            return result.Value.Content.ToString();
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }
}
