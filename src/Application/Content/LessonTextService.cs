using Application.Abstractions;
using Shared.Kernel;
using Domain.Content;

namespace Application.Content;

public sealed class LessonTextService(IContentRepository repo) : ILessonTextService
{
    public async Task<LessonAuthShell?> GetLessonShellAsync(Guid courseId, Guid lessonId, CancellationToken ct)
    {
        var row = await repo.GetLessonMetaAsync(courseId, lessonId, ct);
        return row is null ? null : new LessonAuthShell(row.Id, row.CourseId, row.OwnerId, row.IsFreePreview);
    }

    public async Task<LessonTextDto> CreateAsync(Guid courseId, Guid lessonId, Guid userId, CreateLessonTextRequest req, CancellationToken ct)
    {
        var owner = await repo.GetLessonOwnerAsync(courseId, lessonId, ct);
        if (owner is null) throw new NotFoundException("Lesson not found.");
        if (owner.Value != userId) throw new ForbiddenException();

        var maxAsset = await repo.GetMaxAssetSortAsync(lessonId, ct);
        var maxText = await repo.GetMaxTextSortAsync(lessonId, ct);
        var nextSort = Math.Max(maxAsset ?? -1, maxText ?? -1) + 1;

        var entity = LessonAssetText.Create(lessonId, owner.Value, req.Title, req.BodyMarkdown, nextSort);
        await repo.AddLessonTextAsync(entity, ct);
        await repo.SaveChangesAsync(ct);

        return ToDto(entity);
    }

    public Task<IReadOnlyList<LessonTextDto>> ListAsync(Guid lessonId, CancellationToken ct) =>
        repo.ListLessonTextsAsync(lessonId, ct);

    public async Task<LessonTextDto> UpdateAsync(Guid lessonId, Guid textId, Guid userId, UpdateLessonTextRequest req, CancellationToken ct)
    {
        var text = await repo.GetTrackedTextAsync(textId, lessonId, ct)
            ?? throw new NotFoundException("Text not found.");
        if (text.OwnerId != userId) throw new ForbiddenException();

        if (req.Title is not null) text.Rename(req.Title);
        if (req.BodyMarkdown is not null) text.UpdateText(req.BodyMarkdown);

        await repo.SaveChangesAsync(ct);
        return ToDto(text);
    }

    public async Task DeleteAsync(Guid lessonId, Guid textId, Guid userId, CancellationToken ct)
    {
        var text = await repo.GetTrackedTextAsync(textId, lessonId, ct);
        if (text is null) return; // idempotent
        if (text.OwnerId != userId) throw new ForbiddenException();

        text.DeleteLessonTextAsset();
        await repo.SaveChangesAsync(ct);
    }

    private static LessonTextDto ToDto(LessonAssetText x) =>
        new(x.Id, x.LessonId, x.Title, x.Text, x.SortOrder, x.CreatedAt);
}
