using Application.Abstractions;
using Application.Common;
using AutoMapper;
using Domain.Contracts.Identity;
using Domain.Identity;
using FluentValidation;

namespace Application.Users;

public sealed class UserService(
    IUserRepository repo,
    IValidator<RegisterUserRequest> registerValidator,
    IMapper mapper) : IUserService
{
    public async Task<RegisterUserResult> RegisterAsync(RegisterUserRequest req, CancellationToken ct)
    {
        await registerValidator.ValidateAndThrowAsync(req, ct);

        if (await repo.EmailExistsAsync(req.Email, ct))
            throw new ConflictException("Email already registered.");

        var user = User.Register(req.Email, req.Password);
        await repo.AddAsync(user, ct);
        await repo.SaveChangesAsync(ct);

        return new RegisterUserResult(mapper.Map<UserDto>(user), user.Email.Value, user.VerificationToken!);
    }

    public Task<UserDto?> GetByIdAsync(Guid id, CancellationToken ct) => repo.GetDtoByIdAsync(id, ct);

    public async Task<UpdateProfileResult?> UpdateProfileAsync(Guid userId, UpdateProfileRequest req, CancellationToken ct)
    {
        var user = await repo.GetTrackedByIdAsync(userId, ct);
        if (user is null) return null;

        if (req.DisplayName is not null)
            user.SetDisplayName(req.DisplayName);

        var emailChanged = false;
        string? newEmail = null;
        string? verificationToken = null;

        if (!string.IsNullOrWhiteSpace(req.NewEmail))
        {
            string newEmailValue;
            try { newEmailValue = Email.Create(req.NewEmail).Value; }
            catch { throw new ArgumentException("Invalid email address."); }

            if (await repo.EmailInUseByOtherAsync(newEmailValue, userId, ct))
                throw new ConflictException("An account with that email already exists.");

            user.ChangeEmail(newEmailValue);
            emailChanged = true;
            newEmail = newEmailValue;
            verificationToken = user.VerificationToken;
        }

        if (!string.IsNullOrWhiteSpace(req.CurrentPassword) && !string.IsNullOrWhiteSpace(req.NewPassword))
        {
            if (!user.ChangePassword(req.CurrentPassword, req.NewPassword))
                throw new ArgumentException("Current password is incorrect.");
        }

        await repo.SaveChangesAsync(ct);
        return new UpdateProfileResult(mapper.Map<UserDto>(user), emailChanged, newEmail, verificationToken);
    }

    public async Task<bool> DeleteAsync(Guid userId, CancellationToken ct)
    {
        var user = await repo.GetTrackedByIdAsync(userId, ct);
        if (user is null) return false;

        await repo.RemoveWithTokensAsync(user, ct);
        await repo.SaveChangesAsync(ct);
        return true;
    }

    public Task<PagedResult<UserDto>> ListUsersAsync(string? q, int page, int pageSize, CancellationToken ct)
    {
        page = page <= 0 ? 1 : page;
        pageSize = pageSize is > 0 and <= 100 ? pageSize : 20;
        return repo.ListAsync(q, page, pageSize, ct);
    }

    public async Task<AssignRoleResult> AssignRoleAsync(Guid userId, string roleName, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(roleName))
            throw new ArgumentException("Role name is required.");

        var user = await repo.GetWithRolesAsync(userId, ct)
            ?? throw new NotFoundException("User not found");
        var role = await repo.GetRoleByNameAsync(roleName, ct)
            ?? throw new NotFoundException("Role not found");

        if (user.Roles.All(r => r.Id != role.Id))
        {
            user.Roles.Add(role);
            await repo.SaveChangesAsync(ct);
        }

        return new AssignRoleResult(userId, role.Name);
    }
}
