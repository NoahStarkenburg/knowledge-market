using Application.Catalog;
using Application.Common;
using Contracts.Catalog;
using Domain.Catalog;

namespace Application.Abstractions;

public interface ICourseRepository
{
    // Commands
    Task AddAsync(Course course, CancellationToken ct);
    Task<Course?> GetTrackedAsync(Guid id, CancellationToken ct);
    Task<bool> ExistsAsync(Guid id, CancellationToken ct);
    Task SoftDeleteWithContentAsync(Guid id, DateTimeOffset now, CancellationToken ct);
    Task SaveChangesAsync(CancellationToken ct);

    // Course reads
    Task<CourseView?> GetViewAsync(Guid id, CancellationToken ct);
    Task<CourseShellData?> GetShellAsync(Guid id, bool ignoreQueryFilters, CancellationToken ct);
    Task<PagedResult<CourseDto>> ListAsync(bool isAdmin, Guid userId, CourseStatus? status, int page, int pageSize, CancellationToken ct);
    Task<PagedResult<CourseDto>> BrowsePublishedAsync(int page, int pageSize, CancellationToken ct);
    Task<PagedResult<CourseDto>> ListMineAsync(Guid userId, int page, int pageSize, CancellationToken ct);
    Task<PagedResult<CourseDto>> ListPurchasedAsync(Guid userId, int page, int pageSize, CancellationToken ct);
    Task<PagedResult<CourseDto>> ListPublishedByCreatorAsync(Guid creatorId, int page, int pageSize, CancellationToken ct);
    Task<PagedResult<CourseDto>> SearchAsync(string? q, string[]? tags, decimal? minPrice, decimal? maxPrice, string? sortBy, int page, int pageSize, CancellationToken ct);
    Task<IReadOnlyList<CourseDto>> FeaturedAsync(int count, CancellationToken ct);
    Task<IReadOnlyList<CourseDto>> ByCreatorAsync(Guid creatorId, Guid? exclude, int count, CancellationToken ct);
    Task<CatalogStats> CatalogStatsAsync(CancellationToken ct);
    Task<CourseStats> CourseStatsAsync(Guid id, CancellationToken ct);

    // Reviews
    Task<bool> HasPaidOrderAsync(Guid userId, Guid courseId, CancellationToken ct);
    Task<CourseReview?> GetReviewByReviewerAsync(Guid courseId, Guid reviewerId, CancellationToken ct);
    Task AddReviewAsync(CourseReview review, CancellationToken ct);
    Task RemoveOwnReviewAsync(Guid courseId, Guid userId, CancellationToken ct);
    Task DeleteReviewByIdAsync(Guid reviewId, CancellationToken ct);
    Task<ReviewsPage> ListReviewsAsync(Guid courseId, int page, int pageSize, CancellationToken ct);
}
