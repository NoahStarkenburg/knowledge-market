using Application.Abstractions;
using Infrastructure.Catalog;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Media;

// Reads/writes the thumbnail and intro-video pointers on the course row.
public sealed class MediaRepository(CatalogDbContext catalog) : IMediaRepository
{
    public async Task<Guid?> GetCourseOwnerAsync(Guid courseId, CancellationToken ct) =>
        await catalog.Courses.AsNoTracking()
            .Where(c => c.Id == courseId)
            .Select(c => (Guid?)c.CreatedById)
            .FirstOrDefaultAsync(ct);

    public async Task SetThumbnailAsync(Guid courseId, Guid fileId, CancellationToken ct)
    {
        var course = await catalog.Courses.FirstOrDefaultAsync(c => c.Id == courseId, ct);
        if (course is null) return;
        course.SetThumbnail(fileId);
        await catalog.SaveChangesAsync(ct);
    }

    public async Task SetIntroVideoAsync(Guid courseId, Guid fileId, CancellationToken ct)
    {
        var course = await catalog.Courses.FirstOrDefaultAsync(c => c.Id == courseId, ct);
        if (course is null) return;
        course.SetIntroVideo(fileId);
        await catalog.SaveChangesAsync(ct);
    }

    public async Task<Guid?> GetThumbnailFileIdAsync(Guid courseId, CancellationToken ct) =>
        await catalog.Courses.AsNoTracking()
            .Where(c => c.Id == courseId)
            .Select(c => c.ThumbnailFileId)
            .FirstOrDefaultAsync(ct);

    public async Task<Guid?> GetIntroVideoFileIdAsync(Guid courseId, CancellationToken ct) =>
        await catalog.Courses.AsNoTracking()
            .Where(c => c.Id == courseId)
            .Select(c => c.IntroVideoFileId)
            .FirstOrDefaultAsync(ct);
}
