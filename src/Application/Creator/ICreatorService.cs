using Application.Common;

namespace Application.Creator;

public interface ICreatorService
{
    Task<CreatorDashboard> GetDashboardAsync(Guid creatorId, CancellationToken ct);
    Task<PagedResult<CreatorOrderRow>> ListOrdersAsync(Guid creatorId, int page, int pageSize, CancellationToken ct);
}
