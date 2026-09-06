using Application.Common;
using Contracts.Catalog;

namespace Application.Catalog;

public interface ICourseService
{
    Task<CourseDto> CreateAsync(CreateCourseRequest req, Guid creatorId, CancellationToken ct);
    Task<CourseView?> GetAsync(Guid id, CancellationToken ct);
    Task<CourseShellData?> GetShellAsync(Guid id, bool ignoreQueryFilters, CancellationToken ct);
    Task<PagedResult<CourseDto>> ListAsync(bool isAdmin, Guid userId, string? status, int page, int pageSize, CancellationToken ct);
    Task<PagedResult<CourseDto>> BrowsePublishedAsync(int page, int pageSize, CancellationToken ct);
    Task<PagedResult<CourseDto>> ListMineAsync(Guid userId, int page, int pageSize, CancellationToken ct);
    Task<PagedResult<CourseDto>> ListPurchasedAsync(Guid userId, int page, int pageSize, CancellationToken ct);
    Task<PagedResult<CourseDto>> ListPublishedByCreatorAsync(Guid creatorId, int page, int pageSize, CancellationToken ct);
    Task<PagedResult<CourseDto>> SearchAsync(string? q, string[]? tags, decimal? minPrice, decimal? maxPrice, string? sortBy, int page, int pageSize, CancellationToken ct);
    Task<IReadOnlyList<CourseDto>> FeaturedAsync(int count, CancellationToken ct);
    Task<IReadOnlyList<CourseDto>> ByCreatorAsync(Guid creatorId, Guid? exclude, int count, CancellationToken ct);
    Task<CatalogStats> CatalogStatsAsync(CancellationToken ct);
    Task<CourseStats> CourseStatsAsync(Guid id, CancellationToken ct);
    Task<CourseDto> UpdateAsync(Guid id, UpdateCourseRequest req, CancellationToken ct);
    Task<CourseDto> PublishAsync(Guid id, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<ReviewResult> UpsertReviewAsync(Guid courseId, Guid userId, int rating, string? comment, CancellationToken ct);
    Task<ReviewsPage> ListReviewsAsync(Guid courseId, int page, int pageSize, CancellationToken ct);
    Task DeleteOwnReviewAsync(Guid courseId, Guid userId, CancellationToken ct);
    Task AdminDeleteReviewAsync(Guid reviewId, CancellationToken ct);
}
