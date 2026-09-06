using Application.Abstractions;
using Shared.Kernel;
using Domain.Content;

namespace Application.Content;

public sealed class LessonAssetService(IContentRepository repo) : ILessonAssetService
{
    public async Task<LessonAuthShell?> GetLessonShellAsync(Guid courseId, Guid lessonId, CancellationToken ct)
    {
        var row = await repo.GetLessonMetaAsync(courseId, lessonId, ct);
        return row is null ? null : new LessonAuthShell(row.Id, row.CourseId, row.OwnerId, row.IsFreePreview);
    }

    public async Task<LessonAssetDto> AttachAsync(Guid courseId, Guid lessonId, Guid userId, AttachAssetRequest req, CancellationToken ct)
    {
        var owner = await repo.GetLessonOwnerAsync(courseId, lessonId, ct);
        if (owner is null) throw new NotFoundException("Lesson not found.");
        if (owner.Value != userId) throw new ForbiddenException();

        var file = await repo.GetOwnedContentFileAsync(req.ContentFileId, userId, ct);
        if (file is null) throw new BadRequestException("file not found or not owned by you");

        if (await repo.AssetExistsAsync(lessonId, req.ContentFileId, ct))
            throw new ConflictException("file already attached to lesson");

        var asset = new LessonAsset(lessonId, file.Id, req.Title, req.SortOrder);
        await repo.AddLessonAssetAsync(asset, ct);
        await repo.SaveChangesAsync(ct);

        return new LessonAssetDto(asset.Id, asset.Title, asset.SortOrder, file.FileTitle, file.MimeType, file.FileSize);
    }

    public Task<IReadOnlyList<LessonAssetDto>> ListAsync(Guid lessonId, CancellationToken ct) =>
        repo.ListLessonAssetsAsync(lessonId, ct);

    public async Task UpdateAsync(Guid courseId, Guid lessonId, Guid assetId, Guid userId, UpdateAssetRequest req, CancellationToken ct)
    {
        var owner = await repo.GetLessonOwnerAsync(courseId, lessonId, ct);
        if (owner is null) throw new NotFoundException("Lesson not found.");
        if (owner.Value != userId) throw new ForbiddenException();

        var asset = await repo.GetTrackedAssetAsync(assetId, lessonId, ct)
            ?? throw new NotFoundException("Asset not found.");

        asset.Rename(req.Title);
        asset.Reorder(req.SortOrder);
        await repo.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid courseId, Guid lessonId, Guid assetId, Guid userId, CancellationToken ct)
    {
        var owner = await repo.GetLessonOwnerAsync(courseId, lessonId, ct);
        if (owner is null) throw new NotFoundException("Lesson not found.");
        if (owner.Value != userId) throw new ForbiddenException();

        var asset = await repo.GetTrackedAssetAsync(assetId, lessonId, ct)
            ?? throw new NotFoundException("Asset not found.");

        asset.DeleteLessonAsset();
        await repo.SaveChangesAsync(ct);
    }
}
