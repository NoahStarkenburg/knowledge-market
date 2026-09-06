using Shared.Kernel;
using Application.Creator;

namespace Application.Abstractions;

public interface ICreatorRepository
{
    Task<IReadOnlyList<CreatorCourseRow>> GetCreatorCoursesAsync(Guid creatorId, CancellationToken ct);
    Task<IReadOnlyList<CreatorOrderStat>> GetPaidOrderStatsAsync(IReadOnlyCollection<Guid> courseIds, CancellationToken ct);
    Task<IReadOnlyList<CreatorReviewStat>> GetReviewStatsAsync(IReadOnlyCollection<Guid> courseIds, CancellationToken ct);
    Task<PagedResult<CreatorOrderRow>> ListPaidOrdersAsync(Guid creatorId, int page, int pageSize, CancellationToken ct);
}
