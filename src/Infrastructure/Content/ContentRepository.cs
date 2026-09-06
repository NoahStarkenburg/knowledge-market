using Application.Abstractions;
using Application.Content;
using Domain.Contracts.Content;
using Domain.Content;
using Domain.Contracts.Content;
using Infrastructure.Catalog;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Content;

// Lesson/asset/text/progress data access for the layered Content context. EF Core throughout;
// reaches into Catalog only to resolve the owning course shell for authorization.
public sealed class ContentRepository(
    ContentDbContext content,
    CatalogDbContext catalog) : IContentRepository
{
    // ---- Shells / authorization inputs ----

    public Task<CourseAuthShell?> GetCourseAuthShellAsync(Guid courseId, CancellationToken ct) =>
        catalog.Courses.AsNoTracking()
            .Where(c => c.Id == courseId)
            .Select(c => new CourseAuthShell(c.Id, c.CreatedById, c.PublishedAt != null))
            .FirstOrDefaultAsync(ct)!;

    public Task<LessonMetaRow?> GetLessonMetaAsync(Guid courseId, Guid lessonId, CancellationToken ct) =>
        content.Lessons.AsNoTracking()
            .Where(l => l.Id == lessonId && l.CourseId == courseId)
            .Select(l => new LessonMetaRow(l.Id, l.CourseId, l.OwnerId, l.IsFreePreview, l.Title, l.CreatedAt))
            .FirstOrDefaultAsync(ct)!;

    public Task<LessonAuthShell?> GetLessonAuthShellByIdAsync(Guid lessonId, CancellationToken ct) =>
        content.Lessons.AsNoTracking()
            .Where(l => l.Id == lessonId)
            .Select(l => new LessonAuthShell(l.Id, l.CourseId, l.OwnerId, l.IsFreePreview))
            .SingleOrDefaultAsync(ct)!;

    public Task<LessonAuthShell?> GetAssetDownloadShellAsync(Guid courseId, Guid lessonId, Guid fileId, CancellationToken ct) =>
        (from a in content.LessonAssets.AsNoTracking()
         join l in content.Lessons.AsNoTracking() on a.LessonId equals l.Id
         where a.LessonId == lessonId && l.CourseId == courseId && a.ContentFileId == fileId
         select new LessonAuthShell(l.Id, l.CourseId, l.OwnerId, l.IsFreePreview))
        .SingleOrDefaultAsync(ct)!;

    public async Task<Guid?> GetLessonOwnerAsync(Guid courseId, Guid lessonId, CancellationToken ct) =>
        await content.Lessons.AsNoTracking()
            .Where(l => l.Id == lessonId && l.CourseId == courseId)
            .Select(l => (Guid?)l.OwnerId)
            .FirstOrDefaultAsync(ct);

    // ---- Lessons ----

    public async Task AddLessonAsync(Lesson lesson, CancellationToken ct) =>
        await content.Lessons.AddAsync(lesson, ct);

    public async Task<int?> GetMaxLessonSortAsync(Guid courseId, CancellationToken ct) =>
        await content.Lessons.AsNoTracking()
            .Where(l => l.CourseId == courseId)
            .MaxAsync(l => (int?)l.SortOrder, ct);

    public Task<Lesson?> GetTrackedLessonAsync(Guid courseId, Guid lessonId, CancellationToken ct) =>
        content.Lessons.FirstOrDefaultAsync(l => l.Id == lessonId && l.CourseId == courseId, ct);

    public async Task<IReadOnlyList<LessonListItem>> ListLessonMetaAsync(Guid courseId, CancellationToken ct) =>
        await content.Lessons.AsNoTracking()
            .Where(l => l.CourseId == courseId)
            .OrderBy(l => l.SortOrder).ThenBy(l => l.CreatedAt)
            .Select(l => new LessonListItem(l.Id, l.Title, l.IsFreePreview, l.SortOrder, l.CreatedAt))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Lesson>> GetTrackedLessonsByIdsAsync(Guid courseId, IReadOnlyCollection<Guid> ids, CancellationToken ct) =>
        await content.Lessons
            .Where(l => l.CourseId == courseId && ids.Contains(l.Id))
            .ToListAsync(ct);

    public async Task SoftDeleteLessonCascadeAsync(Guid lessonId, DateTimeOffset now, CancellationToken ct)
    {
        await using var tx = await content.Database.BeginTransactionAsync(ct);

        await content.Lessons
            .IgnoreQueryFilters()
            .Where(l => l.Id == lessonId && l.DeletedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(l => l.DeletedAt, now), ct);

        await content.LessonAssets
            .IgnoreQueryFilters()
            .Where(a => a.LessonId == lessonId && a.DeletedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.DeletedAt, now), ct);

        await content.LessonAssetTexts
            .IgnoreQueryFilters()
            .Where(t => t.LessonId == lessonId && t.DeletedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.DeletedAt, now), ct);

        await tx.CommitAsync(ct);
    }

    public async Task<LessonContentDto?> GetLessonContentAsync(Guid lessonId, CancellationToken ct)
    {
        var lesson = await content.Lessons.AsNoTracking()
            .SingleOrDefaultAsync(l => l.Id == lessonId, ct);
        if (lesson is null) return null;

        var textItems = await content.LessonAssetTexts.AsNoTracking()
            .Where(t => t.LessonId == lessonId)
            .Select(t => new LessonContentItemDto(
                t.Id, "text", t.Title, t.SortOrder, t.CreatedAt,
                t.Text, null, null, null, null, null))
            .ToListAsync(ct);

        var documentItems = await (
            from d in content.LessonAssets.AsNoTracking()
            where d.LessonId == lessonId
            join f in content.ContentFiles.AsNoTracking() on d.ContentFileId equals f.Id
            select new LessonContentItemDto(
                d.Id, "file", d.Title, d.SortOrder, d.CreatedAt,
                null, f.StorageKey, f.FileTitle, f.MimeType, f.FileSize, f.Id))
            .ToListAsync(ct);

        var items = textItems.Concat(documentItems).OrderBy(i => i.SortOrder).ToList();

        return new LessonContentDto(lesson.Id, lesson.CourseId, lesson.Title, lesson.IsFreePreview, items);
    }

    // ---- Content files (uploads) ----

    public async Task<UploadFileResponse> CreateContentFileAsync(Guid userId, string storageKey, string fileName, long fileSize, string mimeType, CancellationToken ct)
    {
        var file = new ContentFile(userId, storageKey, fileName, fileSize, mimeType);
        await content.ContentFiles.AddAsync(file, ct);
        await content.SaveChangesAsync(ct);
        return new UploadFileResponse(file.Id, file.FileTitle, file.FileSize, file.MimeType, file.StorageKey);
    }

    public Task<bool> IsContentFileOwnedByAsync(Guid fileId, Guid userId, CancellationToken ct) =>
        content.ContentFiles.AsNoTracking().AnyAsync(f => f.Id == fileId && f.UserId == userId, ct);

    // ---- Progress ----

    public Task<bool> LessonExistsAsync(Guid courseId, Guid lessonId, CancellationToken ct) =>
        content.Lessons.AsNoTracking().AnyAsync(l => l.Id == lessonId && l.CourseId == courseId, ct);

    public Task<bool> HasProgressAsync(Guid userId, Guid lessonId, CancellationToken ct) =>
        content.LessonProgress.AnyAsync(p => p.UserId == userId && p.LessonId == lessonId, ct);

    public async Task AddProgressAsync(LessonProgress progress, CancellationToken ct) =>
        await content.LessonProgress.AddAsync(progress, ct);

    public Task<LessonProgress?> GetProgressAsync(Guid userId, Guid lessonId, CancellationToken ct) =>
        content.LessonProgress.FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId, ct);

    public void RemoveProgress(LessonProgress progress) => content.LessonProgress.Remove(progress);

    public async Task<IReadOnlyList<Guid>> ListCompletedLessonIdsAsync(Guid userId, Guid courseId, CancellationToken ct) =>
        await content.LessonProgress.AsNoTracking()
            .Where(p => p.UserId == userId && p.CourseId == courseId)
            .Select(p => p.LessonId)
            .ToListAsync(ct);

    // ---- Reorder (content items) ----

    public async Task<IReadOnlyList<LessonAssetText>> GetTrackedTextsAsync(Guid lessonId, IReadOnlyCollection<Guid> textIds, CancellationToken ct) =>
        await content.LessonAssetTexts
            .Where(t => t.LessonId == lessonId && textIds.Contains(t.Id))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<LessonAsset>> GetTrackedAssetsAsync(Guid lessonId, IReadOnlyCollection<Guid> assetIds, CancellationToken ct) =>
        await content.LessonAssets
            .Where(a => a.LessonId == lessonId && assetIds.Contains(a.Id))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<int>> GetOtherTextSortOrdersAsync(Guid lessonId, IReadOnlyCollection<Guid> excludeTextIds, CancellationToken ct) =>
        await content.LessonAssetTexts.AsNoTracking()
            .Where(t => t.LessonId == lessonId && !excludeTextIds.Contains(t.Id))
            .Select(t => t.SortOrder)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<int>> GetOtherAssetSortOrdersAsync(Guid lessonId, IReadOnlyCollection<Guid> excludeAssetIds, CancellationToken ct) =>
        await content.LessonAssets.AsNoTracking()
            .Where(a => a.LessonId == lessonId && !excludeAssetIds.Contains(a.Id))
            .Select(a => a.SortOrder)
            .ToListAsync(ct);

    // ---- Lesson assets ----

    public Task<ContentFileInfo?> GetOwnedContentFileAsync(Guid fileId, Guid userId, CancellationToken ct) =>
        content.ContentFiles.AsNoTracking()
            .Where(f => f.Id == fileId && f.UserId == userId)
            .Select(f => new ContentFileInfo(f.Id, f.FileTitle, f.MimeType, f.FileSize))
            .FirstOrDefaultAsync(ct)!;

    public Task<bool> AssetExistsAsync(Guid lessonId, Guid contentFileId, CancellationToken ct) =>
        content.LessonAssets.AsNoTracking().AnyAsync(a => a.LessonId == lessonId && a.ContentFileId == contentFileId, ct);

    public async Task AddLessonAssetAsync(LessonAsset asset, CancellationToken ct) =>
        await content.LessonAssets.AddAsync(asset, ct);

    public async Task<IReadOnlyList<LessonAssetDto>> ListLessonAssetsAsync(Guid lessonId, CancellationToken ct) =>
        await (from a in content.LessonAssets.AsNoTracking()
               join f in content.ContentFiles.AsNoTracking() on a.ContentFileId equals f.Id
               where a.LessonId == lessonId
               orderby a.SortOrder
               select new LessonAssetDto(a.Id, a.Title, a.SortOrder, f.FileTitle, f.MimeType, f.FileSize))
            .ToListAsync(ct);

    public Task<LessonAsset?> GetTrackedAssetAsync(Guid assetId, Guid lessonId, CancellationToken ct) =>
        content.LessonAssets.FirstOrDefaultAsync(a => a.Id == assetId && a.LessonId == lessonId, ct);

    // ---- Lesson texts ----

    public async Task<int?> GetMaxAssetSortAsync(Guid lessonId, CancellationToken ct) =>
        await content.LessonAssets.Where(a => a.LessonId == lessonId).MaxAsync(a => (int?)a.SortOrder, ct);

    public async Task<int?> GetMaxTextSortAsync(Guid lessonId, CancellationToken ct) =>
        await content.LessonAssetTexts.Where(t => t.LessonId == lessonId).MaxAsync(t => (int?)t.SortOrder, ct);

    public async Task AddLessonTextAsync(LessonAssetText text, CancellationToken ct) =>
        await content.LessonAssetTexts.AddAsync(text, ct);

    public async Task<IReadOnlyList<LessonTextDto>> ListLessonTextsAsync(Guid lessonId, CancellationToken ct) =>
        await content.LessonAssetTexts.AsNoTracking()
            .Where(t => t.LessonId == lessonId)
            .OrderBy(t => t.SortOrder).ThenBy(t => t.CreatedAt)
            .Select(t => new LessonTextDto(t.Id, t.LessonId, t.Title, t.Text, t.SortOrder, t.CreatedAt))
            .ToListAsync(ct);

    public Task<LessonAssetText?> GetTrackedTextAsync(Guid textId, Guid lessonId, CancellationToken ct) =>
        content.LessonAssetTexts.FirstOrDefaultAsync(t => t.Id == textId && t.LessonId == lessonId, ct);

    public async Task SaveChangesAsync(CancellationToken ct) => await content.SaveChangesAsync(ct);
}
