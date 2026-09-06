using Domain.Contracts.Content;
using Domain.Contracts.Content;

namespace Application.Content;

public interface ILessonService
{
    // Shells for controller-side resource authorization.
    Task<CourseAuthShell?> GetCourseShellAsync(Guid courseId, CancellationToken ct);
    Task<LessonMetaRow?> GetLessonMetaAsync(Guid courseId, Guid lessonId, CancellationToken ct);
    Task<LessonAuthShell?> GetLessonShellByIdAsync(Guid lessonId, CancellationToken ct);
    Task<LessonAuthShell?> GetAssetDownloadShellAsync(Guid courseId, Guid lessonId, Guid fileId, CancellationToken ct);

    Task<Guid> CreateLessonAsync(Guid courseId, CreateLessonRequest req, Guid ownerId, CancellationToken ct);
    Task<IReadOnlyList<LessonListItem>> ListLessonsAsync(Guid courseId, CancellationToken ct);
    Task<LessonContentDto?> GetLessonContentAsync(Guid lessonId, CancellationToken ct);
    Task UpdateLessonAsync(Guid courseId, Guid lessonId, UpdateLessonRequest req, CancellationToken ct);
    Task DeleteLessonAsync(Guid lessonId, CancellationToken ct);
    Task ReorderLessonsAsync(Guid courseId, IReadOnlyCollection<BulkReorderItem> items, CancellationToken ct);
    Task ReorderLessonContentAsync(Guid courseId, Guid lessonId, Guid userId, IReadOnlyCollection<BulkReorderItem> items, CancellationToken ct);

    Task<UploadFileResponse> RegisterUploadedFileAsync(Guid userId, string storageKey, string fileName, long fileSize, string mimeType, CancellationToken ct);
    Task<bool> IsUploadOwnedByUserAsync(Guid fileId, Guid userId, CancellationToken ct);

    Task MarkLessonCompleteAsync(Guid userId, Guid courseId, Guid lessonId, CancellationToken ct);
    Task UnmarkLessonCompleteAsync(Guid userId, Guid lessonId, CancellationToken ct);
    Task<IReadOnlyList<Guid>> GetCompletedLessonIdsAsync(Guid userId, Guid courseId, CancellationToken ct);
}
