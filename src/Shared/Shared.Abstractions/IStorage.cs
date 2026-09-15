namespace Shared.Abstractions;

public sealed record FileMeta(string Mime, long Size, string FileName, DateTimeOffset LastModifiedUtc);

public sealed record SignedReadOptions
{
    public string Disposition { get; init; } = "attachment";
    public string? FileName { get; init; }
    public TimeSpan Expires { get; init; } = TimeSpan.FromMinutes(10);
    public string? ResponseContentType { get; init; }
}

// Headers are the ones the client must send with its PUT, because stores differ: S3 signs
// Content-Type into the URL, and Azure also requires x-ms-blob-type.
public sealed record PresignedUpload(string Url, string Key, IReadOnlyDictionary<string, string> Headers);

// Binary object storage port. Implemented by LocalStorage, S3Storage and AzureBlobStorage.
public interface IStorage
{
    Task<string> SaveAsync(Guid userId, string fileName, string mime, Stream content, CancellationToken ct);
    Task<Stream> OpenReadAsync(Guid contentFileId, CancellationToken ct);
    Task<FileMeta> GetMetadataAsync(Guid contentFileId, CancellationToken ct);
    Task<string?> TryGetSignedReadUrl(Guid contentFileId, SignedReadOptions options, CancellationToken ct);
    Task DeleteAsync(Guid contentFileId, CancellationToken ct);

    // Direct upload: the browser PUTs the bytes straight to the store, so the
    // API never proxies them. Returns null when the provider can't presign (local
    // disk), signalling the caller to fall back to a proxied upload.
    Task<PresignedUpload?> TryCreateUploadUrlAsync(Guid userId, string fileName, string mime, CancellationToken ct);

    // HEAD an object by key to read its real size; null if it doesn't exist.
    // Used to confirm a direct upload landed before recording it.
    Task<long?> TryGetObjectSizeAsync(string key, CancellationToken ct);
}
