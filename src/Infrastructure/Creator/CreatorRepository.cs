using Application.Abstractions;
using Application.Common;
using Application.Creator;
using Domain.Orders;
using Infrastructure.Catalog;
using Infrastructure.Orders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Creator;

// Read-only aggregation for the creator dashboard and order list. Spans Catalog (courses,
// reviews) and Orders (paid orders).
public sealed class CreatorRepository(CatalogDbContext catalog, OrdersDbContext orders) : ICreatorRepository
{
    public async Task<IReadOnlyList<CreatorCourseRow>> GetCreatorCoursesAsync(Guid creatorId, CancellationToken ct) =>
        await catalog.Courses.AsNoTracking()
            .Where(c => c.CreatedById == creatorId)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new CreatorCourseRow(c.Id, c.Title.Value, c.Status, c.ThumbnailFileId, c.CreatedAt, c.PublishedAt))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<CreatorOrderStat>> GetPaidOrderStatsAsync(IReadOnlyCollection<Guid> courseIds, CancellationToken ct) =>
        await orders.Orders.AsNoTracking()
            .Where(o => courseIds.Contains(o.CourseId) && o.Status == Orderstatus.Paid)
            .GroupBy(o => o.CourseId)
            .Select(g => new CreatorOrderStat(g.Key, g.LongCount(), g.Sum(o => o.Price.Amount), g.Min(o => o.Price.Currency)!))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<CreatorReviewStat>> GetReviewStatsAsync(IReadOnlyCollection<Guid> courseIds, CancellationToken ct) =>
        await catalog.CourseReviews.AsNoTracking()
            .Where(r => courseIds.Contains(r.CourseId))
            .GroupBy(r => r.CourseId)
            .Select(g => new CreatorReviewStat(g.Key, g.LongCount(), g.Average(r => (double)r.Rating)))
            .ToListAsync(ct);

    public async Task<PagedResult<CreatorOrderRow>> ListPaidOrdersAsync(Guid creatorId, int page, int pageSize, CancellationToken ct)
    {
        var courseIds = await catalog.Courses.AsNoTracking()
            .Where(c => c.CreatedById == creatorId)
            .Select(c => c.Id)
            .ToListAsync(ct);

        if (courseIds.Count == 0)
            return new PagedResult<CreatorOrderRow>(page, pageSize, 0L, Array.Empty<CreatorOrderRow>());

        var query = orders.Orders.AsNoTracking()
            .Where(o => courseIds.Contains(o.CourseId) && o.Status == Orderstatus.Paid)
            .OrderByDescending(o => o.PaidAt);

        var total = await query.LongCountAsync(ct);

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new CreatorOrderRow(o.Id, o.CourseId, o.CourseTitleSnapshot, o.Price.Amount, o.Price.Currency, o.PaidAt))
            .ToListAsync(ct);

        return new PagedResult<CreatorOrderRow>(page, pageSize, total, items);
    }
}
