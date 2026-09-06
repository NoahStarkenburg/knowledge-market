namespace Application.Content;

public interface ILessonAssetService
{
    Task<LessonAuthShell?> GetLessonShellAsync(Guid courseId, Guid lessonId, CancellationToken ct);
    Task<LessonAssetDto> AttachAsync(Guid courseId, Guid lessonId, Guid userId, AttachAssetRequest req, CancellationToken ct);
    Task<IReadOnlyList<LessonAssetDto>> ListAsync(Guid lessonId, CancellationToken ct);
    Task UpdateAsync(Guid courseId, Guid lessonId, Guid assetId, Guid userId, UpdateAssetRequest req, CancellationToken ct);
    Task DeleteAsync(Guid courseId, Guid lessonId, Guid assetId, Guid userId, CancellationToken ct);
}
