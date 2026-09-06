using Application.Common;
using Contracts.Identity;
using Domain.Identity;

namespace Application.Abstractions;

public interface IUserRepository
{
    Task<bool> EmailExistsAsync(string email, CancellationToken ct);
    Task<bool> EmailInUseByOtherAsync(string email, Guid excludeUserId, CancellationToken ct);
    Task AddAsync(User user, CancellationToken ct);
    Task<User?> GetTrackedByIdAsync(Guid id, CancellationToken ct);
    Task<UserDto?> GetDtoByIdAsync(Guid id, CancellationToken ct);
    Task RemoveWithTokensAsync(User user, CancellationToken ct);
    Task<PagedResult<UserDto>> ListAsync(string? q, int page, int pageSize, CancellationToken ct);
    Task<User?> GetWithRolesAsync(Guid id, CancellationToken ct);
    Task<Role?> GetRoleByNameAsync(string name, CancellationToken ct);
    Task SaveChangesAsync(CancellationToken ct);
}
