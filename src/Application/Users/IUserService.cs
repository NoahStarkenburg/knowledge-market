using Application.Common;
using Contracts.Identity;

namespace Application.Users;

public interface IUserService
{
    Task<RegisterUserResult> RegisterAsync(RegisterUserRequest req, CancellationToken ct);
    Task<UserDto?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<UpdateProfileResult?> UpdateProfileAsync(Guid userId, UpdateProfileRequest req, CancellationToken ct);
    Task<bool> DeleteAsync(Guid userId, CancellationToken ct);
    Task<PagedResult<UserDto>> ListUsersAsync(string? q, int page, int pageSize, CancellationToken ct);
    Task<AssignRoleResult> AssignRoleAsync(Guid userId, string roleName, CancellationToken ct);
}

// Returned so the web layer can send the verification/welcome emails it is responsible for.
public sealed record RegisterUserResult(UserDto User, string Email, string VerificationToken);

public sealed record UpdateProfileResult(UserDto User, bool EmailChanged, string? NewEmail, string? VerificationToken);

public sealed record AssignRoleResult(Guid UserId, string Role);
