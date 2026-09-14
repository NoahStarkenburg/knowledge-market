using Application.Abstractions;
using Shared.Abstractions;
using Application.Catalog;
using Shared.Kernel;
using Application.Content;

namespace Application.Uploads;

public sealed class UploadService(
    IStorage storage,
    IContentRepository content,
    IMediaRepository media,
    ICacheStore cache) : IUploadService
{
    private const long MaxUploadBytes = 500L * 1024L * 1024L; // 500 MB

    public async Task<PresignResponse> PresignAsync(Guid userId, PresignRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.FileName))
            throw new BadRequestException("missing fileName");

        var mime = string.IsNullOrWhiteSpace(req.ContentType) ? "application/octet-stream" : req.ContentType;
        if (!UploadMimeTypes.IsAllowed(mime))
            throw new BadRequestException("unsupported mime type");

        var presigned = await storage.TryCreateUploadUrlAsync(userId, req.FileName, mime, ct);
        return presigned is null
            ? new PresignResponse("proxy", null, null, null)
            : new PresignResponse("direct", presigned.Url, presigned.Key, presigned.Headers);
    }

    public async Task<UploadFileResponse> ConfirmAsync(Guid userId, ConfirmRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Key))
            throw new BadRequestException("missing key");

        // The presigned key is scoped to the caller; reject anyone else's key.
        if (!req.Key.StartsWith($"staged/{userId:n}/", StringComparison.Ordinal))
            throw new ForbiddenException();

        var mime = string.IsNullOrWhiteSpace(req.ContentType) ? "application/octet-stream" : req.ContentType;
        if (!UploadMimeTypes.IsAllowed(mime))
            throw new BadRequestException("unsupported mime type");

        // HEAD confirms the object landed and gives us its real size (never trust a
        // client-declared size).
        var size = await storage.TryGetObjectSizeAsync(req.Key, ct);
        if (size is null)
            throw new BadRequestException("object not found; upload may have failed");
        if (size > MaxUploadBytes)
            throw new BadRequestException("file too large");

        var safeName = Path.GetFileName(string.IsNullOrWhiteSpace(req.FileName) ? "upload.bin" : req.FileName);
        return await content.CreateContentFileAsync(userId, req.Key, safeName, size.Value, mime, ct);
    }

    public Task<Guid?> GetCourseOwnerAsync(Guid courseId, CancellationToken ct) =>
        media.GetCourseOwnerAsync(courseId, ct);

    public async Task<Guid> SetThumbnailAsync(Guid courseId, Guid userId, string storageKey, string fileName, long size, string mime, CancellationToken ct)
    {
        var uploaded = await content.CreateContentFileAsync(userId, storageKey, fileName, size, mime, ct);
        await media.SetThumbnailAsync(courseId, uploaded.Id, ct);
        // ThumbnailFileId is part of the cached course detail, so evict it here too.
        await cache.RemoveAsync(CacheKeys.Course(courseId), ct);
        return uploaded.Id;
    }

    public async Task<Guid> SetIntroVideoAsync(Guid courseId, Guid userId, string storageKey, string fileName, long size, string mime, CancellationToken ct)
    {
        var uploaded = await content.CreateContentFileAsync(userId, storageKey, fileName, size, mime, ct);
        await media.SetIntroVideoAsync(courseId, uploaded.Id, ct);
        // IntroVideoFileId is part of the cached course detail, so evict it here too.
        await cache.RemoveAsync(CacheKeys.Course(courseId), ct);
        return uploaded.Id;
    }

    public Task<Guid?> GetThumbnailFileIdAsync(Guid courseId, CancellationToken ct) =>
        media.GetThumbnailFileIdAsync(courseId, ct);

    public Task<Guid?> GetIntroVideoFileIdAsync(Guid courseId, CancellationToken ct) =>
        media.GetIntroVideoFileIdAsync(courseId, ct);
}
