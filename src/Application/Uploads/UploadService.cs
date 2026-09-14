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
        var upload = await VerifyDirectUploadAsync(userId, req, UploadMimeTypes.IsAllowed, UploadLimits.LessonFileBytes, ct);
        return await content.CreateContentFileAsync(userId, upload.Key, upload.FileName, upload.Size, upload.Mime, ct);
    }

    public async Task<Guid> ConfirmThumbnailAsync(Guid courseId, Guid userId, ConfirmRequest req, CancellationToken ct)
    {
        await RequireCourseOwnerAsync(courseId, userId, ct);
        var upload = await VerifyDirectUploadAsync(userId, req, UploadMimeTypes.IsThumbnail, UploadLimits.ThumbnailBytes, ct);
        return await SetThumbnailAsync(courseId, userId, upload.Key, upload.FileName, upload.Size, upload.Mime, ct);
    }

    public async Task<Guid> ConfirmIntroVideoAsync(Guid courseId, Guid userId, ConfirmRequest req, CancellationToken ct)
    {
        await RequireCourseOwnerAsync(courseId, userId, ct);
        var upload = await VerifyDirectUploadAsync(userId, req, UploadMimeTypes.IsVideo, UploadLimits.IntroVideoBytes, ct);
        return await SetIntroVideoAsync(courseId, userId, upload.Key, upload.FileName, upload.Size, upload.Mime, ct);
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

    private async Task RequireCourseOwnerAsync(Guid courseId, Guid userId, CancellationToken ct)
    {
        var owner = await media.GetCourseOwnerAsync(courseId, ct)
            ?? throw new NotFoundException("Course not found.");
        if (owner != userId)
            throw new ForbiddenException();
    }

    // A direct upload reaches storage before the API sees a single byte, so the checks the multipart
    // path makes up front happen here instead: the key was issued to this caller, the type is
    // allowed, and the size, read from storage rather than trusted from the client, is in the limit.
    private async Task<VerifiedUpload> VerifyDirectUploadAsync(
        Guid userId, ConfirmRequest req, Func<string, bool> isAllowedType, long maxBytes, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Key))
            throw new BadRequestException("missing key");

        // Presigned keys start with the caller's id; reject anyone else's.
        if (!req.Key.StartsWith($"staged/{userId:n}/", StringComparison.Ordinal))
            throw new ForbiddenException();

        var mime = string.IsNullOrWhiteSpace(req.ContentType) ? "application/octet-stream" : req.ContentType;
        if (!isAllowedType(mime))
            throw new BadRequestException("unsupported mime type");

        var size = await storage.TryGetObjectSizeAsync(req.Key, ct)
            ?? throw new BadRequestException("object not found; upload may have failed");

        if (size > maxBytes)
        {
            // Nothing references the object yet, so delete it rather than leave an orphan in storage.
            await storage.DeleteObjectAsync(req.Key, ct);
            throw new BadRequestException("file too large");
        }

        var safeName = Path.GetFileName(string.IsNullOrWhiteSpace(req.FileName) ? "upload.bin" : req.FileName);
        return new VerifiedUpload(req.Key, safeName, size, mime);
    }

    private sealed record VerifiedUpload(string Key, string FileName, long Size, string Mime);
}
