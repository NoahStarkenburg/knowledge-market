using System.Net.Http.Headers;
using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using Infrastructure.Content;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Shared.Abstractions;

namespace Infrastructure.Storage;

// IStorage on Azure Blob Storage. Same contract as S3Storage: the database maps a file id to a
// blob name, and the bytes live in one private container. The browser never gets credentials,
// only short-lived SAS URLs for a single blob.
public sealed class AzureBlobStorage(
    BlobServiceClient service,
    AzureBlobSasSigner signer,
    ContentDbContext db,
    IConfiguration cfg) : IStorage
{
    private readonly BlobContainerClient _container =
        service.GetBlobContainerClient(cfg["Storage:AzureBlob:AssetContainer"] ?? "assets");

    public async Task<string> SaveAsync(Guid userId, string fileName, string mime, Stream content, CancellationToken ct)
    {
        var key = NewKey(userId, fileName);

        await _container.GetBlobClient(key).UploadAsync(content, new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders { ContentType = mime },
        }, ct);

        return key;
    }

    public async Task<PresignedUpload?> TryCreateUploadUrlAsync(Guid userId, string fileName, string mime, CancellationToken ct)
    {
        var key = NewKey(userId, fileName);

        // Create only: the URL can make this one new blob, and cannot read it, overwrite it
        // afterwards, or touch any other blob.
        var url = await signer.SignAsync(
            _container.GetBlobClient(key), BlobSasPermissions.Create, TimeSpan.FromMinutes(10), null, ct);

        // Headers the browser must send with its PUT. Azure refuses an upload that does not say
        // which kind of blob to create, and Content-Type becomes the blob's stored type.
        var headers = new Dictionary<string, string>
        {
            ["x-ms-blob-type"] = "BlockBlob",
            ["Content-Type"] = mime,
        };

        return new PresignedUpload(url.ToString(), key, headers);
    }

    public async Task<long?> TryGetObjectSizeAsync(string key, CancellationToken ct)
    {
        try
        {
            var props = await _container.GetBlobClient(key).GetPropertiesAsync(cancellationToken: ct);
            return props.Value.ContentLength;
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }

    public async Task<Stream> OpenReadAsync(Guid contentFileId, CancellationToken ct)
    {
        var key = await FindKeyAsync(contentFileId, ct)
            ?? throw new FileNotFoundException("Content file not found.", contentFileId.ToString());

        try
        {
            // A seekable stream that downloads in chunks as it is read, so range requests
            // (seeking in a video) work on the proxied path too.
            return await _container.GetBlobClient(key).OpenReadAsync(cancellationToken: ct);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            throw new FileNotFoundException("Blob not found.", key);
        }
    }

    public async Task<FileMeta> GetMetadataAsync(Guid contentFileId, CancellationToken ct)
    {
        var cf = await db.ContentFiles.AsNoTracking()
            .Where(f => f.Id == contentFileId)
            .Select(f => new { f.MimeType, f.FileSize, f.FileTitle, f.CreatedAt })
            .FirstOrDefaultAsync(ct)
            ?? throw new FileNotFoundException("Content file not found.", contentFileId.ToString());

        return new FileMeta(
            Mime: string.IsNullOrWhiteSpace(cf.MimeType) ? "application/octet-stream" : cf.MimeType,
            Size: cf.FileSize,
            FileName: string.IsNullOrWhiteSpace(cf.FileTitle) ? "download.bin" : cf.FileTitle,
            LastModifiedUtc: cf.CreatedAt.ToUniversalTime()
        );
    }

    public async Task<string?> TryGetSignedReadUrl(Guid contentFileId, SignedReadOptions options, CancellationToken ct)
    {
        var key = await FindKeyAsync(contentFileId, ct);
        if (key is null) return null;

        var url = await signer.SignAsync(_container.GetBlobClient(key), BlobSasPermissions.Read, options.Expires, sas =>
        {
            // Signed into the URL, and Azure sends them back as response headers: whether the
            // browser shows the file or saves it, and under what name. filename* is the
            // encoded form, so names with quotes or non-ASCII characters cannot break the header.
            sas.ContentDisposition = new ContentDispositionHeaderValue(options.Disposition)
            {
                FileNameStar = options.FileName ?? Path.GetFileName(key),
            }.ToString();

            if (options.ResponseContentType is not null)
                sas.ContentType = options.ResponseContentType;
        }, ct);

        return url.ToString();
    }

    public async Task DeleteAsync(Guid contentFileId, CancellationToken ct)
    {
        var file = await db.ContentFiles
            .Where(f => f.Id == contentFileId)
            .Select(f => new { f.Id, f.StorageKey })
            .FirstOrDefaultAsync(ct)
            ?? throw new FileNotFoundException("Content file not found.", contentFileId.ToString());

        var isAttached = await db.LessonAssets.AnyAsync(a => a.ContentFileId == contentFileId, ct);
        if (isAttached)
            throw new InvalidOperationException("File is attached to a lesson and cannot be deleted.");

        await _container.GetBlobClient(file.StorageKey).DeleteIfExistsAsync(cancellationToken: ct);

        var row = await db.ContentFiles.FindAsync([contentFileId], ct);
        if (row is not null)
        {
            db.ContentFiles.Remove(row);
            await db.SaveChangesAsync(ct);
        }
    }

    // Same layout as the other providers. UploadService.ConfirmAsync relies on the
    // "staged/{userId}/" prefix to reject a key that belongs to someone else.
    private static string NewKey(Guid userId, string fileName) =>
        $"staged/{userId:n}/{Guid.NewGuid():n}/{Path.GetFileName(fileName)}";

    private Task<string?> FindKeyAsync(Guid contentFileId, CancellationToken ct) =>
        db.ContentFiles.AsNoTracking()
            .Where(f => f.Id == contentFileId)
            .Select(f => f.StorageKey)
            .FirstOrDefaultAsync(ct);
}
