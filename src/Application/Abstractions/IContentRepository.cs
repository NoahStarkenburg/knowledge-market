using Application.Content;
using Contracts.Content;
using Domain.Content;
using Domain.Contracts.Content;

namespace Application.Abstractions;

public interface IContentRepository
{
    // ---- Shells / authorization inputs ----
    Task<CourseAuthShell?> GetCourseAuthShellAsync(Guid courseId, CancellationToken ct);
    Task<LessonMetaRow?> GetLessonMetaAsync(Guid courseId, Guid lessonId, CancellationToken ct);
    Task<LessonAuthShell?> GetLessonAuthShellByIdAsync(Guid lessonId, CancellationToken ct);
    Task<LessonAuthShell?> GetAssetDownloadShellAsync(Guid courseId, Guid lessonId, Guid fileId, CancellationToken ct);
    Task<Guid?> GetLessonOwnerAsync(Guid courseId, Guid lessonId, CancellationToken ct);

    // ---- Lessons ----
    Task AddLessonAsync(Lesson lesson, CancellationToken ct);
    Task<int?> GetMaxLessonSortAsync(Guid courseId, CancellationToken ct);
    Task<Lesson?> GetTrackedLessonAsync(Guid courseId, Guid lessonId, CancellationToken ct);
    Task<IReadOnlyList<LessonListItem>> ListLessonMetaAsync(Guid courseId, CancellationToken ct);
    Task<IReadOnlyList<Lesson>> GetTrackedLessonsByIdsAsync(Guid courseId, IReadOnlyCollection<Guid> ids, CancellationToken ct);
    Task SoftDeleteLessonCascadeAsync(Guid lessonId, DateTimeOffset now, CancellationToken ct);
    Task<LessonContentDto?> GetLessonContentAsync(Guid lessonId, CancellationToken ct);

    // ---- Content files (uploads) ----
    Task<UploadFileResponse> CreateContentFileAsync(Guid userId, string storageKey, string fileName, long fileSize, string mimeType, CancellationToken ct);
    Task<bool> IsContentFileOwnedByAsync(Guid fileId, Guid userId, CancellationToken ct);

    // ---- Progress ----
    Task<bool> LessonExistsAsync(Guid courseId, Guid lessonId, CancellationToken ct);
    Task<bool> HasProgressAsync(Guid userId, Guid lessonId, CancellationToken ct);
    Task AddProgressAsync(LessonProgress progress, CancellationToken ct);
    Task<LessonProgress?> GetProgressAsync(Guid userId, Guid lessonId, CancellationToken ct);
    void RemoveProgress(LessonProgress progress);
    Task<IReadOnlyList<Guid>> ListCompletedLessonIdsAsync(Guid userId, Guid courseId, CancellationToken ct);

    // ---- Reorder (content items) ----
    Task<IReadOnlyList<LessonAssetText>> GetTrackedTextsAsync(Guid lessonId, IReadOnlyCollection<Guid> textIds, CancellationToken ct);
    Task<IReadOnlyList<LessonAsset>> GetTrackedAssetsAsync(Guid lessonId, IReadOnlyCollection<Guid> assetIds, CancellationToken ct);
    Task<IReadOnlyList<int>> GetOtherTextSortOrdersAsync(Guid lessonId, IReadOnlyCollection<Guid> excludeTextIds, CancellationToken ct);
    Task<IReadOnlyList<int>> GetOtherAssetSortOrdersAsync(Guid lessonId, IReadOnlyCollection<Guid> excludeAssetIds, CancellationToken ct);

    // ---- Lesson assets ----
    Task<ContentFileInfo?> GetOwnedContentFileAsync(Guid fileId, Guid userId, CancellationToken ct);
    Task<bool> AssetExistsAsync(Guid lessonId, Guid contentFileId, CancellationToken ct);
    Task AddLessonAssetAsync(LessonAsset asset, CancellationToken ct);
    Task<IReadOnlyList<LessonAssetDto>> ListLessonAssetsAsync(Guid lessonId, CancellationToken ct);
    Task<LessonAsset?> GetTrackedAssetAsync(Guid assetId, Guid lessonId, CancellationToken ct);

    // ---- Lesson texts ----
    Task<int?> GetMaxAssetSortAsync(Guid lessonId, CancellationToken ct);
    Task<int?> GetMaxTextSortAsync(Guid lessonId, CancellationToken ct);
    Task AddLessonTextAsync(LessonAssetText text, CancellationToken ct);
    Task<IReadOnlyList<LessonTextDto>> ListLessonTextsAsync(Guid lessonId, CancellationToken ct);
    Task<LessonAssetText?> GetTrackedTextAsync(Guid textId, Guid lessonId, CancellationToken ct);

    Task SaveChangesAsync(CancellationToken ct);
}
