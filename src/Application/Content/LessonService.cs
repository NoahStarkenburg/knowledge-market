using Application.Abstractions;
using Shared.Abstractions;
using Shared.Kernel;
using Domain.Contracts.Content;
using Domain.Content;
using Domain.Contracts.Content;
using FluentValidation;
using FluentValidation.Results;

namespace Application.Content;

public sealed class LessonService(
    IContentRepository repo,
    IContentStorage storage,
    IValidator<CreateLessonRequest> createValidator,
    IValidator<UpdateLessonRequest> updateValidator) : ILessonService
{
    public Task<CourseAuthShell?> GetCourseShellAsync(Guid courseId, CancellationToken ct) =>
        repo.GetCourseAuthShellAsync(courseId, ct);

    public Task<LessonMetaRow?> GetLessonMetaAsync(Guid courseId, Guid lessonId, CancellationToken ct) =>
        repo.GetLessonMetaAsync(courseId, lessonId, ct);

    public Task<LessonAuthShell?> GetLessonShellByIdAsync(Guid lessonId, CancellationToken ct) =>
        repo.GetLessonAuthShellByIdAsync(lessonId, ct);

    public Task<LessonAuthShell?> GetAssetDownloadShellAsync(Guid courseId, Guid lessonId, Guid fileId, CancellationToken ct) =>
        repo.GetAssetDownloadShellAsync(courseId, lessonId, fileId, ct);

    public async Task<Guid> CreateLessonAsync(Guid courseId, CreateLessonRequest req, Guid ownerId, CancellationToken ct)
    {
        await createValidator.ValidateAndThrowAsync(req, ct);

        var lesson = Lesson.Create(courseId, ownerId, req.Title, req.IsFreePreview);

        var maxSort = await repo.GetMaxLessonSortAsync(courseId, ct);
        lesson.Reorder((maxSort ?? -1) + 1);

        var path = await storage.SaveLessonBodyAsync(courseId, lesson.Id, req.Body, ct);
        lesson.SetStoragePath(path);

        await repo.AddLessonAsync(lesson, ct);
        await repo.SaveChangesAsync(ct);
        return lesson.Id;
    }

    public Task<IReadOnlyList<LessonListItem>> ListLessonsAsync(Guid courseId, CancellationToken ct) =>
        repo.ListLessonMetaAsync(courseId, ct);

    public Task<LessonContentDto?> GetLessonContentAsync(Guid lessonId, CancellationToken ct) =>
        repo.GetLessonContentAsync(lessonId, ct);

    public async Task UpdateLessonAsync(Guid courseId, Guid lessonId, UpdateLessonRequest req, CancellationToken ct)
    {
        await updateValidator.ValidateAndThrowAsync(req, ct);

        var lesson = await repo.GetTrackedLessonAsync(courseId, lessonId, ct)
            ?? throw new NotFoundException("Lesson not found.");

        if (req.Title is not null) lesson.UpdateTitle(req.Title);
        if (req.IsFreePreview is not null) lesson.SetFreePreview(req.IsFreePreview.Value);
        if (req.Body is not null)
        {
            var path = await storage.SaveLessonBodyAsync(courseId, lesson.Id, req.Body, ct);
            lesson.SetStoragePath(path);
        }

        await repo.SaveChangesAsync(ct);
    }

    public Task DeleteLessonAsync(Guid lessonId, CancellationToken ct) =>
        repo.SoftDeleteLessonCascadeAsync(lessonId, DateTimeOffset.UtcNow, ct);

    public async Task ReorderLessonsAsync(Guid courseId, IReadOnlyCollection<BulkReorderItem> items, CancellationToken ct)
    {
        var ids = items.Select(i => i.Id).ToList();
        var lessons = await repo.GetTrackedLessonsByIdsAsync(courseId, ids, ct);

        if (lessons.Count != ids.Count)
            throw Invalid("items", "One or more lesson IDs do not belong to this course.");

        foreach (var item in items)
        {
            var lesson = lessons.First(l => l.Id == item.Id);
            lesson.Reorder(item.NewSort);
        }

        await repo.SaveChangesAsync(ct);
    }

    public async Task ReorderLessonContentAsync(Guid courseId, Guid lessonId, Guid userId, IReadOnlyCollection<BulkReorderItem> items, CancellationToken ct)
    {
        var owner = await repo.GetLessonOwnerAsync(courseId, lessonId, ct);
        if (owner is null) throw new NotFoundException("Lesson not found.");
        if (owner.Value != userId) throw new ForbiddenException();

        var dup = items.GroupBy(i => i.NewSort).FirstOrDefault(g => g.Count() > 1);
        if (dup is not null)
            throw Invalid("sortOrder", $"Duplicate sort order {dup.Key} in request.");

        var textIds = items.Where(i => i.Kind == "text").Select(i => i.Id).ToList();
        var assetIds = items.Where(i => i.Kind == "file").Select(i => i.Id).ToList();

        var texts = await repo.GetTrackedTextsAsync(lessonId, textIds, ct);
        var assets = await repo.GetTrackedAssetsAsync(lessonId, assetIds, ct);

        if (textIds.Count != texts.Count || assetIds.Count != assets.Count)
            throw Invalid("items", "One or more item IDs do not belong to this lesson.");

        var existingTextOrders = await repo.GetOtherTextSortOrdersAsync(lessonId, textIds, ct);
        var existingAssetOrders = await repo.GetOtherAssetSortOrdersAsync(lessonId, assetIds, ct);

        var occupiedOrders = existingTextOrders.Concat(existingAssetOrders).ToHashSet();
        var conflict = items.FirstOrDefault(i => occupiedOrders.Contains(i.NewSort));
        if (conflict is not null)
            throw Invalid("sortOrder", $"Sort order {conflict.NewSort} conflicts with an item not in this request.");

        foreach (var text in texts)
        {
            var req = items.First(i => i.Kind == "text" && i.Id == text.Id);
            if (text.SortOrder != req.NewSort) text.ReOrder(req.NewSort);
        }

        foreach (var asset in assets)
        {
            var req = items.First(i => i.Kind == "file" && i.Id == asset.Id);
            if (asset.SortOrder != req.NewSort) asset.Reorder(req.NewSort);
        }

        await repo.SaveChangesAsync(ct);
    }

    public Task<UploadFileResponse> RegisterUploadedFileAsync(Guid userId, string storageKey, string fileName, long fileSize, string mimeType, CancellationToken ct) =>
        repo.CreateContentFileAsync(userId, storageKey, fileName, fileSize, mimeType, ct);

    public Task<bool> IsUploadOwnedByUserAsync(Guid fileId, Guid userId, CancellationToken ct) =>
        repo.IsContentFileOwnedByAsync(fileId, userId, ct);

    public async Task MarkLessonCompleteAsync(Guid userId, Guid courseId, Guid lessonId, CancellationToken ct)
    {
        if (!await repo.LessonExistsAsync(courseId, lessonId, ct))
            throw new NotFoundException("Lesson not found.");

        if (await repo.HasProgressAsync(userId, lessonId, ct)) return;

        await repo.AddProgressAsync(LessonProgress.Create(userId, lessonId, courseId), ct);
        await repo.SaveChangesAsync(ct);
    }

    public async Task UnmarkLessonCompleteAsync(Guid userId, Guid lessonId, CancellationToken ct)
    {
        var row = await repo.GetProgressAsync(userId, lessonId, ct);
        if (row is null) return;
        repo.RemoveProgress(row);
        await repo.SaveChangesAsync(ct);
    }

    public Task<IReadOnlyList<Guid>> GetCompletedLessonIdsAsync(Guid userId, Guid courseId, CancellationToken ct) =>
        repo.ListCompletedLessonIdsAsync(userId, courseId, ct);

    private static ValidationException Invalid(string property, string message) =>
        new(new[] { new ValidationFailure(property, message) });
}
