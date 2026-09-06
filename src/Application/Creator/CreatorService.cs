using Application.Abstractions;
using Application.Common;
using Domain.Catalog;

namespace Application.Creator;

public sealed class CreatorService(ICreatorRepository repo) : ICreatorService
{
    public async Task<CreatorDashboard> GetDashboardAsync(Guid creatorId, CancellationToken ct)
    {
        var courses = await repo.GetCreatorCoursesAsync(creatorId, ct);

        if (courses.Count == 0)
            return new CreatorDashboard(0, 0, 0, 0L, 0m, 0L, null, Array.Empty<CreatorCourseStats>());

        var courseIds = courses.Select(c => c.Id).ToList();

        var orderStats = await repo.GetPaidOrderStatsAsync(courseIds, ct);
        var reviewStats = await repo.GetReviewStatsAsync(courseIds, ct);

        var orderMap = orderStats.ToDictionary(x => x.CourseId);
        var reviewMap = reviewStats.ToDictionary(x => x.CourseId);

        var courseRows = courses.Select(c =>
        {
            orderMap.TryGetValue(c.Id, out var o);
            reviewMap.TryGetValue(c.Id, out var r);
            return new CreatorCourseStats(
                c.Id,
                c.Title,
                c.Status.ToString(),
                c.ThumbnailFileId,
                c.PublishedAt,
                o?.Count ?? 0L,
                o?.Revenue ?? 0m,
                o?.Currency ?? "usd",
                r?.Count ?? 0L,
                r?.Avg);
        }).ToList();

        var totalEnrollments = courseRows.Sum(c => c.Enrollments);
        var totalRevenue = courseRows.Sum(c => c.Revenue);
        var totalReviews = courseRows.Sum(c => c.ReviewCount);
        var avgRating = totalReviews > 0
            ? courseRows.Where(c => c.ReviewCount > 0).Average(c => c.AverageRating!.Value)
            : (double?)null;

        return new CreatorDashboard(
            courses.Count,
            courses.Count(c => c.Status == CourseStatus.Published),
            courses.Count(c => c.Status == CourseStatus.Draft),
            totalEnrollments,
            totalRevenue,
            totalReviews,
            avgRating.HasValue ? Math.Round(avgRating.Value, 2) : (double?)null,
            courseRows);
    }

    public Task<PagedResult<CreatorOrderRow>> ListOrdersAsync(Guid creatorId, int page, int pageSize, CancellationToken ct)
    {
        page = page <= 0 ? 1 : page;
        pageSize = pageSize is > 0 and <= 100 ? pageSize : 20;
        return repo.ListPaidOrdersAsync(creatorId, page, pageSize, ct);
    }
}
