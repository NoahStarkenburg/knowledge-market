using System.Linq.Expressions;
using System.Text.Json;
using Application.Abstractions;
using Application.Catalog;
using Application.Common;
using Contracts.Catalog;
using Dapper;
using Domain.Catalog;
using Domain.Orders;
using Infrastructure.Content;
using Infrastructure.Orders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Catalog;

// Course/review data access. EF Core for writes and most reads; Dapper for the search read
// and the catalog.catalog_stats() function. Reaches into Orders and Content for the
// cross-context reads and the cascade soft-delete.
public sealed class CourseRepository(
    CatalogDbContext catalog,
    OrdersDbContext orders,
    ContentDbContext content) : ICourseRepository
{
    private static readonly Expression<Func<Course, CourseDto>> ToDtoProjection = c => new CourseDto(
        c.Id, c.Title.Value, c.Description, c.Price.Amount, c.Price.Currency,
        c.Status.ToString(), c.CreatedAt, c.PublishedAt, c.CreatedById, c.Tags, c.ThumbnailFileId, c.IntroVideoFileId);

    // ---- Commands ----

    public async Task AddAsync(Course course, CancellationToken ct) => await catalog.Courses.AddAsync(course, ct);

    public Task<Course?> GetTrackedAsync(Guid id, CancellationToken ct) =>
        catalog.Courses.FirstOrDefaultAsync(c => c.Id == id, ct);

    public Task<bool> ExistsAsync(Guid id, CancellationToken ct) =>
        catalog.Courses.AsNoTracking().AnyAsync(c => c.Id == id, ct);

    public async Task SaveChangesAsync(CancellationToken ct)
    {
        try { await catalog.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        { throw new ConflictException("Course was modified by someone else. Reload and retry."); }
    }

    public async Task SoftDeleteWithContentAsync(Guid id, DateTimeOffset now, CancellationToken ct)
    {
        // Catalog is authoritative: mark the course deleted first, in its own transaction.
        await using (var tx1 = await catalog.Database.BeginTransactionAsync(ct))
        {
            await catalog.Courses.IgnoreQueryFilters()
                .Where(c => c.Id == id && c.DeletedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.DeletedAt, now), ct);
            await tx1.CommitAsync(ct);
        }

        // Best-effort cleanup in Content, in a separate transaction.
        try
        {
            await using var tx2 = await content.Database.BeginTransactionAsync(ct);

            var lessonIds = await content.Lessons.IgnoreQueryFilters()
                .Where(l => l.CourseId == id)
                .Select(l => l.Id)
                .ToListAsync(ct);

            if (lessonIds.Count > 0)
            {
                await content.Lessons.IgnoreQueryFilters()
                    .Where(l => l.CourseId == id && l.DeletedAt == null)
                    .ExecuteUpdateAsync(s => s.SetProperty(l => l.DeletedAt, now), ct);

                await content.LessonAssets.IgnoreQueryFilters()
                    .Where(a => lessonIds.Contains(a.LessonId) && a.DeletedAt == null)
                    .ExecuteUpdateAsync(s => s.SetProperty(a => a.DeletedAt, now), ct);

                await content.LessonAssetTexts.IgnoreQueryFilters()
                    .Where(t => lessonIds.Contains(t.LessonId) && t.DeletedAt == null)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.DeletedAt, now), ct);
            }

            await tx2.CommitAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        { throw new ConflictException("Resource was modified by someone else. Reload and retry."); }
        catch (DbUpdateException)
        { throw new ConflictException("Cannot delete due to existing references. Delete anything attached to this course"); }
    }

    // ---- Course reads ----

    public Task<CourseView?> GetViewAsync(Guid id, CancellationToken ct) =>
        catalog.Courses.AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new CourseView(
                new CourseDto(c.Id, c.Title.Value, c.Description, c.Price.Amount, c.Price.Currency,
                    c.Status.ToString(), c.CreatedAt, c.PublishedAt, c.CreatedById, c.Tags, c.ThumbnailFileId, c.IntroVideoFileId),
                c.Status == CourseStatus.Published,
                c.CreatedById))
            .FirstOrDefaultAsync(ct);

    public Task<CourseShellData?> GetShellAsync(Guid id, bool ignoreQueryFilters, CancellationToken ct)
    {
        var q = catalog.Courses.AsNoTracking();
        if (ignoreQueryFilters) q = q.IgnoreQueryFilters();
        return q.Where(c => c.Id == id)
            .Select(c => new CourseShellData(c.Id, c.CreatedById, c.Status == CourseStatus.Published))
            .FirstOrDefaultAsync(ct);
    }

    public async Task<PagedResult<CourseDto>> ListAsync(bool isAdmin, Guid userId, CourseStatus? status, int page, int pageSize, CancellationToken ct)
    {
        IQueryable<Course> q = catalog.Courses.AsNoTracking();

        if (isAdmin)
        {
            if (status is not null) q = q.Where(c => c.Status == status);
        }
        else
        {
            q = q.Where(c => c.Status == CourseStatus.Published ||
                             (c.CreatedById == userId && c.Status == CourseStatus.Draft));
            if (status == CourseStatus.Draft)
                q = q.Where(c => c.CreatedById == userId && c.Status == CourseStatus.Draft);
            if (status == CourseStatus.Published)
                q = q.Where(c => c.Status == CourseStatus.Published);
        }

        return await PageAsync(q.OrderByDescending(c => c.CreatedAt), page, pageSize, ct);
    }

    public async Task<PagedResult<CourseDto>> BrowsePublishedAsync(int page, int pageSize, CancellationToken ct)
    {
        var list = catalog.Courses.AsNoTracking()
            .Where(c => c.Status == CourseStatus.Published)
            .OrderByDescending(c => c.CreatedAt);

        return await PageAsync(list, page, pageSize, ct);
    }

    public Task<PagedResult<CourseDto>> ListMineAsync(Guid userId, int page, int pageSize, CancellationToken ct) =>
        PageAsync(catalog.Courses.AsNoTracking().Where(c => c.CreatedById == userId).OrderByDescending(c => c.CreatedAt), page, pageSize, ct);

    public Task<PagedResult<CourseDto>> ListPublishedByCreatorAsync(Guid creatorId, int page, int pageSize, CancellationToken ct) =>
        PageAsync(
            catalog.Courses.AsNoTracking()
                .Where(c => c.CreatedById == creatorId && c.Status == CourseStatus.Published)
                .OrderByDescending(c => c.PublishedAt),
            page, pageSize, ct);

    public async Task<PagedResult<CourseDto>> ListPurchasedAsync(Guid userId, int page, int pageSize, CancellationToken ct)
    {
        var purchasedIds = await orders.Orders.AsNoTracking()
            .Where(o => o.BuyerId == userId && o.Status == Orderstatus.Paid)
            .Select(o => o.CourseId)
            .ToListAsync(ct);

        var q = catalog.Courses.AsNoTracking()
            .Where(c => purchasedIds.Contains(c.Id))
            .OrderByDescending(c => c.CreatedAt);

        return await PageAsync(q, page, pageSize, ct);
    }

    public async Task<PagedResult<CourseDto>> SearchAsync(string? q, string[]? tags, decimal? minPrice, decimal? maxPrice, string? sortBy, int page, int pageSize, CancellationToken ct)
    {
        var where = new List<string> { "status = 1", "deleted_at IS NULL" };
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(q))
        {
            // Postgres matched a maintained tsvector; SQL Server searches the source columns
            // directly. LIKE is case-insensitive under the database's default collation, which
            // is what ILIKE gave us before. Tags live in a JSON column, so they need OPENJSON.
            var trimmed = q.Trim();
            where.Add(@"(title LIKE @like OR description LIKE @like
                         OR EXISTS (SELECT 1 FROM OPENJSON(tags) AS jt WHERE jt.[value] LIKE @like))");
            p.Add("like", $"%{trimmed}%");
        }
        if (tags is { Length: > 0 })
        {
            // Passed as a scalar CSV (not an array) so Dapper doesn't expand it into a
            // parameter list. STRING_SPLIT turns it back into rows; the EXISTS is the
            // equivalent of Postgres's array-overlap (&&) operator.
            where.Add(@"EXISTS (SELECT 1 FROM OPENJSON(tags) AS jt
                                JOIN STRING_SPLIT(@tagscsv, ',') AS st ON st.[value] = jt.[value])");
            p.Add("tagscsv", string.Join(",", tags));
        }
        if (minPrice is not null) { where.Add("price_amount >= @min"); p.Add("min", minPrice.Value); }
        if (maxPrice is not null) { where.Add("price_amount <= @max"); p.Add("max", maxPrice.Value); }

        var whereSql = string.Join(" AND ", where);
        var orderSql = sortBy?.ToLowerInvariant() switch
        {
            "price_asc" => "price_amount ASC",
            "price_desc" => "price_amount DESC",
            _ => "published_at DESC"
        };

        var conn = catalog.Database.GetDbConnection();

        var total = await conn.ExecuteScalarAsync<long>(
            new CommandDefinition($"SELECT count(*) FROM catalog.courses WHERE {whereSql}", p, cancellationToken: ct));

        p.Add("limit", pageSize);
        p.Add("offset", (page - 1) * pageSize);

        var sql = $@"
SELECT [Id] AS [Id], title AS [Title], description AS [Description],
       price_amount AS [PriceAmount], price_currency AS [PriceCurrency],
       CASE status WHEN 1 THEN 'Published' ELSE 'Draft' END AS [Status],
       created_at AS [CreatedAt], published_at AS [PublishedAt], created_by_id AS [CreatedById],
       tags AS [TagsJson], thumbnail_file_id AS [ThumbnailFileId], intro_video_file_id AS [IntroVideoFileId]
FROM catalog.courses
WHERE {whereSql}
ORDER BY {orderSql}
OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY";

        var rows = await conn.QueryAsync<CourseRow>(new CommandDefinition(sql, p, cancellationToken: ct));
        return new PagedResult<CourseDto>(page, pageSize, total, rows.Select(ToDto).ToList());
    }

    public async Task<IReadOnlyList<CourseDto>> FeaturedAsync(int count, CancellationToken ct) =>
        await catalog.Courses.AsNoTracking()
            .Where(c => c.Status == CourseStatus.Published)
            .OrderByDescending(c => c.PublishedAt ?? c.CreatedAt)
            .Take(count)
            .Select(ToDtoProjection)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<CourseDto>> ByCreatorAsync(Guid creatorId, Guid? exclude, int count, CancellationToken ct) =>
        await catalog.Courses.AsNoTracking()
            .Where(c => c.CreatedById == creatorId && c.Status == CourseStatus.Published && (exclude == null || c.Id != exclude))
            .OrderByDescending(c => c.PublishedAt ?? c.CreatedAt)
            .Take(count)
            .Select(ToDtoProjection)
            .ToListAsync(ct);

    public async Task<CatalogStats> CatalogStatsAsync(CancellationToken ct)
    {
        var conn = catalog.Database.GetDbConnection();
        return await conn.QuerySingleAsync<CatalogStats>(new CommandDefinition(
            "SELECT PublishedCourses, Creators FROM catalog.catalog_stats()",
            cancellationToken: ct));
    }

    public async Task<CourseStats> CourseStatsAsync(Guid id, CancellationToken ct)
    {
        var enrollmentCount = await orders.Orders.AsNoTracking()
            .LongCountAsync(o => o.CourseId == id && o.Status == Orderstatus.Paid, ct);

        var totalRevenue = await orders.Orders.AsNoTracking()
            .Where(o => o.CourseId == id && o.Status == Orderstatus.Paid)
            .SumAsync(o => (decimal?)o.Price.Amount, ct) ?? 0m;

        var reviewStats = await catalog.CourseReviews.AsNoTracking()
            .Where(r => r.CourseId == id)
            .GroupBy(_ => true)
            .Select(g => new { Count = g.LongCount(), Avg = g.Average(r => (double)r.Rating) })
            .FirstOrDefaultAsync(ct);

        return new CourseStats(enrollmentCount, totalRevenue, reviewStats?.Count ?? 0, reviewStats?.Avg);
    }

    // ---- Reviews ----

    public Task<bool> HasPaidOrderAsync(Guid userId, Guid courseId, CancellationToken ct) =>
        orders.Orders.AsNoTracking()
            .AnyAsync(o => o.BuyerId == userId && o.CourseId == courseId && o.Status == Orderstatus.Paid, ct);

    public Task<CourseReview?> GetReviewByReviewerAsync(Guid courseId, Guid reviewerId, CancellationToken ct) =>
        catalog.CourseReviews.FirstOrDefaultAsync(r => r.CourseId == courseId && r.ReviewerId == reviewerId, ct);

    public async Task AddReviewAsync(CourseReview review, CancellationToken ct) =>
        await catalog.CourseReviews.AddAsync(review, ct);

    public async Task RemoveOwnReviewAsync(Guid courseId, Guid userId, CancellationToken ct)
    {
        var review = await catalog.CourseReviews.FirstOrDefaultAsync(r => r.CourseId == courseId && r.ReviewerId == userId, ct);
        if (review is null) return;
        catalog.CourseReviews.Remove(review);
        await catalog.SaveChangesAsync(ct);
    }

    public async Task DeleteReviewByIdAsync(Guid reviewId, CancellationToken ct)
    {
        var review = await catalog.CourseReviews.FindAsync([reviewId], ct);
        if (review is null) return;
        catalog.CourseReviews.Remove(review);
        await catalog.SaveChangesAsync(ct);
    }

    public async Task<ReviewsPage> ListReviewsAsync(Guid courseId, int page, int pageSize, CancellationToken ct)
    {
        var query = catalog.CourseReviews.AsNoTracking().Where(r => r.CourseId == courseId);

        var total = await query.LongCountAsync(ct);
        var avg = total > 0 ? await query.AverageAsync(r => (double)r.Rating, ct) : (double?)null;

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new ReviewDto(r.Id, r.CourseId, r.ReviewerId, r.Rating, r.Comment, r.CreatedAt))
            .ToListAsync(ct);

        return new ReviewsPage(page, pageSize, total, avg, items);
    }

    private static async Task<PagedResult<CourseDto>> PageAsync(IQueryable<Course> ordered, int page, int pageSize, CancellationToken ct)
    {
        var total = await ordered.LongCountAsync(ct);
        var items = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ToDtoProjection)
            .ToListAsync(ct);
        return new PagedResult<CourseDto>(page, pageSize, total, items);
    }

    private static CourseDto ToDto(CourseRow r) => new(
        r.Id, r.Title, r.Description, r.PriceAmount, r.PriceCurrency, r.Status,
        r.CreatedAt, r.PublishedAt,
        r.CreatedById, ParseTags(r.TagsJson), r.ThumbnailFileId, r.IntroVideoFileId);

    // EF stores the tag collection as a JSON array; Dapper hands it back as raw text.
    private static string[] ParseTags(string? json) =>
        string.IsNullOrWhiteSpace(json)
            ? []
            : JsonSerializer.Deserialize<string[]>(json) ?? [];

    // Dapper row (mutable class so Dapper maps by property setter; datetimeoffset columns
    // come back as DateTimeOffset directly, so no Kind fixup is needed).
    private sealed class CourseRow
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = "";
        public string? Description { get; set; }
        public decimal PriceAmount { get; set; }
        public string PriceCurrency { get; set; } = "";
        public string Status { get; set; } = "";
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? PublishedAt { get; set; }
        public Guid CreatedById { get; set; }
        public string? TagsJson { get; set; }
        public Guid? ThumbnailFileId { get; set; }
        public Guid? IntroVideoFileId { get; set; }
    }
}
