using Application.Content;

namespace Application.Uploads;

public interface IUploadService
{
    Task<PresignResponse> PresignAsync(Guid userId, PresignRequest req, CancellationToken ct);
    Task<UploadFileResponse> ConfirmAsync(Guid userId, ConfirmRequest req, CancellationToken ct);

    // Confirm a direct upload as a course's thumbnail or intro video. Returns the new file id.
    Task<Guid> ConfirmThumbnailAsync(Guid courseId, Guid userId, ConfirmRequest req, CancellationToken ct);
    Task<Guid> ConfirmIntroVideoAsync(Guid courseId, Guid userId, ConfirmRequest req, CancellationToken ct);

    Task<Guid?> GetCourseOwnerAsync(Guid courseId, CancellationToken ct);
    Task<Guid> SetThumbnailAsync(Guid courseId, Guid userId, string storageKey, string fileName, long size, string mime, CancellationToken ct);
    Task<Guid> SetIntroVideoAsync(Guid courseId, Guid userId, string storageKey, string fileName, long size, string mime, CancellationToken ct);
    Task<Guid?> GetThumbnailFileIdAsync(Guid courseId, CancellationToken ct);
    Task<Guid?> GetIntroVideoFileIdAsync(Guid courseId, CancellationToken ct);
}
