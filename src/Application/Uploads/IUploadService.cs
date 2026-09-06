using Application.Content;

namespace Application.Uploads;

public interface IUploadService
{
    Task<PresignResponse> PresignAsync(Guid userId, PresignRequest req, CancellationToken ct);
    Task<UploadFileResponse> ConfirmAsync(Guid userId, ConfirmRequest req, CancellationToken ct);

    Task<Guid?> GetCourseOwnerAsync(Guid courseId, CancellationToken ct);
    Task<Guid> SetThumbnailAsync(Guid courseId, Guid userId, string storageKey, string fileName, long size, string mime, CancellationToken ct);
    Task<Guid> SetIntroVideoAsync(Guid courseId, Guid userId, string storageKey, string fileName, long size, string mime, CancellationToken ct);
    Task<Guid?> GetThumbnailFileIdAsync(Guid courseId, CancellationToken ct);
    Task<Guid?> GetIntroVideoFileIdAsync(Guid courseId, CancellationToken ct);
}
