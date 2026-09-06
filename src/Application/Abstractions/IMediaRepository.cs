namespace Application.Abstractions;

// Course-media data access (thumbnail / intro-video pointers on the course row).
public interface IMediaRepository
{
    Task<Guid?> GetCourseOwnerAsync(Guid courseId, CancellationToken ct);
    Task SetThumbnailAsync(Guid courseId, Guid fileId, CancellationToken ct);
    Task SetIntroVideoAsync(Guid courseId, Guid fileId, CancellationToken ct);
    Task<Guid?> GetThumbnailFileIdAsync(Guid courseId, CancellationToken ct);
    Task<Guid?> GetIntroVideoFileIdAsync(Guid courseId, CancellationToken ct);
}
