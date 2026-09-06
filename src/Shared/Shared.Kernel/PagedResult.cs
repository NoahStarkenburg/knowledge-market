namespace Shared.Kernel;

// Standard paged list shape used by list endpoints: { page, pageSize, total, items }.
public sealed record PagedResult<T>(int Page, int PageSize, long Total, IReadOnlyList<T> Items);
