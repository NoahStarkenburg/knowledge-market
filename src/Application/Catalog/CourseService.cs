using System.Runtime.InteropServices;
using Application.Abstractions;
using Application.Common;
using AutoMapper;
using Domain.Contracts.Catalog;
using Domain.Catalog;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace Application.Catalog;

public sealed class CourseService(
    ICourseRepository repo,
    IValidator<CreateCourseRequest> createValidator,
    IValidator<UpdateCourseRequest> updateValidator,
    IMapper mapper,
    ICacheStore cache,
    SingleFlight singleFlight,
    AppMetrics metrics,
    ILogger<CourseService> log) : ICourseService
{
    // Per-course detail is cached with a precise invalidation on every write, so the TTL is only a
    // safety net that bounds staleness if an invalidation is ever missed (e.g. Redis down mid-write).
    private static readonly TimeSpan CourseDetailTtl = TimeSpan.FromMinutes(5);
    // The catalog stat is a shared, anonymous, landing-page aggregate; a short TTL keeps it fresh
    // enough without the cost of invalidating on every publish/delete across the platform.
    private static readonly TimeSpan CatalogStatsTtl = TimeSpan.FromSeconds(60);

    public async Task<CourseDto> CreateAsync(CreateCourseRequest req, Guid creatorId, CancellationToken ct)
    {
        await createValidator.ValidateAndThrowAsync(req, ct);

        var course = Course.Create(req.Title, req.Description, req.PriceAmount, req.PriceCurrency, creatorId);
        if (req.Tags is { Length: > 0 }) course.SetTags(req.Tags);

        await repo.AddAsync(course, ct);
        await repo.SaveChangesAsync(ct);

        return mapper.Map<CourseDto>(course);
    }

    // Cache-aside for the course detail read (hit on every course page view, identical for all
    // viewers). The controller's draft-visibility check runs on the cached IsPublished/CreatedById
    // fields, so no per-user data is cached.
    public Task<CourseView?> GetAsync(Guid id, CancellationToken ct) =>
        cache.GetOrSetAsync(CacheKeys.Course(id), CourseDetailTtl, c => repo.GetViewAsync(id, c), ct);

    public Task<CourseShellData?> GetShellAsync(Guid id, bool ignoreQueryFilters, CancellationToken ct) =>
        repo.GetShellAsync(id, ignoreQueryFilters, ct);

    public Task<PagedResult<CourseDto>> ListAsync(bool isAdmin, Guid userId, string? status, int page, int pageSize, CancellationToken ct)
    {
        CourseStatus? requestedStatus = null;
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<CourseStatus>(status, true, out var st))
            requestedStatus = st;

        (page, pageSize) = Normalize(page, pageSize);
        return repo.ListAsync(isAdmin, userId, requestedStatus, page, pageSize, ct);
    }

    public async Task<PagedResult<CourseDto>> BrowsePublishedAsync(int page, int pageSize, CancellationToken ct)
    {
        (page, pageSize) = Normalize(page, pageSize);
        var courses = await cache.GetAsync<PagedResult<CourseDto>>(CacheKeys.Courses(page,pageSize), ct);
        if (courses is not null) return courses;

        var list = await singleFlight.RunAsync(CacheKeys.Courses(page, pageSize), async () =>
        {
            var cached = await cache.GetAsync<PagedResult<CourseDto>>(CacheKeys.Courses(page, pageSize), ct);
            if (cached is not null) return cached;

            var fresh = await repo.BrowsePublishedAsync(page, pageSize, ct);
            await cache.SetAsync(CacheKeys.Courses(page, pageSize), fresh, TimeSpan.FromMinutes(1), ct);
            return fresh;
        });
        return list!;
    }

    public Task<PagedResult<CourseDto>> ListMineAsync(Guid userId, int page, int pageSize, CancellationToken ct)
    {
        (page, pageSize) = Normalize(page, pageSize);
        return repo.ListMineAsync(userId, page, pageSize, ct);
    }

    public Task<PagedResult<CourseDto>> ListPurchasedAsync(Guid userId, int page, int pageSize, CancellationToken ct)
    {
        (page, pageSize) = Normalize(page, pageSize);
        return repo.ListPurchasedAsync(userId, page, pageSize, ct);
    }

    public Task<PagedResult<CourseDto>> ListPublishedByCreatorAsync(Guid creatorId, int page, int pageSize, CancellationToken ct)
    {
        (page, pageSize) = Normalize(page, pageSize);
        return repo.ListPublishedByCreatorAsync(creatorId, page, pageSize, ct);
    }

    public Task<PagedResult<CourseDto>> SearchAsync(string? q, string[]? tags, decimal? minPrice, decimal? maxPrice, string? sortBy, int page, int pageSize, CancellationToken ct)
    {
        (page, pageSize) = Normalize(page, pageSize);
        return repo.SearchAsync(q, tags, minPrice, maxPrice, sortBy, page, pageSize, ct);
    }

    public Task<IReadOnlyList<CourseDto>> FeaturedAsync(int count, CancellationToken ct) =>
        repo.FeaturedAsync(count is > 0 and <= 20 ? count : 6, ct);

    public Task<IReadOnlyList<CourseDto>> ByCreatorAsync(Guid creatorId, Guid? exclude, int count, CancellationToken ct) =>
        repo.ByCreatorAsync(creatorId, exclude, count is > 0 and <= 12 ? count : 4, ct);

    // TTL-only cache-aside (no invalidation). This is a plpgsql aggregate over the courses and
    // users tables, served anonymously on the landing page, so it is the single highest-value read
    // to keep off Postgres. A newly published course shows up in the count within one TTL window,
    // which is an acceptable trade for not invalidating on every platform-wide publish/delete.
    public async Task<CatalogStats> CatalogStatsAsync(CancellationToken ct)
    {
        // Fast path: the vast majority of requests hit the warm cache and never coordinate.
        var cached = await cache.GetAsync<CatalogStats>(CacheKeys.CatalogStats, ct);
        if (cached is not null) return cached;

        // Cold key: single-flight collapses a concurrent burst of misses into one rebuild, so an
        // expiry on this hot landing-page key can't stampede Postgres with duplicate aggregates.
        var stats = await singleFlight.RunAsync(CacheKeys.CatalogStats, async () =>
        {
            // Re-check under the coalesced call: a prior leader may have just populated the cache
            // (the double-checked-locking idiom), so a late arrival returns without touching the DB.
            var again = await cache.GetAsync<CatalogStats>(CacheKeys.CatalogStats, ct);
            if (again is not null) return again;

            var fresh = await repo.CatalogStatsAsync(ct);
            await cache.SetAsync(CacheKeys.CatalogStats, fresh, CatalogStatsTtl, ct);
            return fresh;
        });
        return stats!; // the factory always returns a non-null CatalogStats
    }

    public Task<CourseStats> CourseStatsAsync(Guid id, CancellationToken ct) => repo.CourseStatsAsync(id, ct);

    public async Task<CourseDto> UpdateAsync(Guid id, UpdateCourseRequest req, CancellationToken ct)
    {
        await updateValidator.ValidateAndThrowAsync(req, ct);

        var course = await repo.GetTrackedAsync(id, ct)
            ?? throw new NotFoundException("Course not found.");

        if (course.Status == CourseStatus.Published)
            throw new BadRequestException("Published courses cannot be edited.");

        if (!string.IsNullOrWhiteSpace(req.Title)) course.Rename(req.Title);
        if (req.Description is not null) course.UpdateDescription(req.Description);
        if (req.PriceAmount is not null || !string.IsNullOrWhiteSpace(req.PriceCurrency))
        {
            var amount = req.PriceAmount ?? course.Price.Amount;
            var currency = string.IsNullOrWhiteSpace(req.PriceCurrency) ? course.Price.Currency : req.PriceCurrency!;
            course.ChangePrice(amount, currency);
        }
        if (req.Tags is not null) course.SetTags(req.Tags);

        await repo.SaveChangesAsync(ct);
        await cache.RemoveAsync(CacheKeys.Course(id), ct);

        metrics.RecordCoursePublished();
        log.LogInformation("Course {CourseId} published", id);

        return mapper.Map<CourseDto>(course);
    }

    public async Task<CourseDto> PublishAsync(Guid id, CancellationToken ct)
    {
        var course = await repo.GetTrackedAsync(id, ct)
            ?? throw new NotFoundException("Course not found.");

        try { course.Publish(); }
        catch (InvalidOperationException ex) { throw new BadRequestException(ex.Message); }

        await repo.SaveChangesAsync(ct);
        await cache.RemoveAsync(CacheKeys.Course(id), ct);
        return mapper.Map<CourseDto>(course);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        await repo.SoftDeleteWithContentAsync(id, DateTimeOffset.UtcNow, ct);
        await cache.RemoveAsync(CacheKeys.Course(id), ct);
    }

    public async Task<ReviewResult> UpsertReviewAsync(Guid courseId, Guid userId, int rating, string? comment, CancellationToken ct)
    {
        if (rating is < 1 or > 5)
            throw new BadRequestException("Rating must be between 1 and 5.");

        if (!await repo.HasPaidOrderAsync(userId, courseId, ct))
            throw new ForbiddenException();

        if (!await repo.ExistsAsync(courseId, ct))
            throw new NotFoundException("Course not found.");

        var existing = await repo.GetReviewByReviewerAsync(courseId, userId, ct);
        if (existing is not null)
        {
            existing.Update(rating, comment);
            await repo.SaveChangesAsync(ct);
            return new ReviewResult(mapper.Map<ReviewDto>(existing), Created: false);
        }

        var review = CourseReview.Create(courseId, userId, rating, comment);
        await repo.AddReviewAsync(review, ct);
        await repo.SaveChangesAsync(ct);
        return new ReviewResult(mapper.Map<ReviewDto>(review), Created: true);
    }

    public Task<ReviewsPage> ListReviewsAsync(Guid courseId, int page, int pageSize, CancellationToken ct)
    {
        page = page <= 0 ? 1 : page;
        pageSize = pageSize is > 0 and <= 50 ? pageSize : 20;
        return repo.ListReviewsAsync(courseId, page, pageSize, ct);
    }

    public Task DeleteOwnReviewAsync(Guid courseId, Guid userId, CancellationToken ct) =>
        repo.RemoveOwnReviewAsync(courseId, userId, ct);

    public Task AdminDeleteReviewAsync(Guid reviewId, CancellationToken ct) =>
        repo.DeleteReviewByIdAsync(reviewId, ct);

    private static (int page, int pageSize) Normalize(int page, int pageSize) =>
        (page <= 0 ? 1 : page, pageSize is > 0 and <= 100 ? pageSize : 20);
}
