using Application.Abstractions;
using Shared.Kernel;
using Domain.Contracts.Identity;
using Domain.Identity;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Identity;

// EF Core implementation of the Users data access. Writes go through change tracking;
// reads project straight to UserDto DB-side.
public sealed class UserRepository(UsersDbContext db) : IUserRepository
{
    public Task<bool> EmailExistsAsync(string email, CancellationToken ct) =>
        db.Users.AsNoTracking().AnyAsync(u => u.Email.Value == email, ct);

    public Task<bool> EmailInUseByOtherAsync(string email, Guid excludeUserId, CancellationToken ct) =>
        db.Users.AsNoTracking().AnyAsync(u => u.Email.Value == email && u.Id != excludeUserId, ct);

    public async Task AddAsync(User user, CancellationToken ct) => await db.Users.AddAsync(user, ct);

    public Task<User?> GetTrackedByIdAsync(Guid id, CancellationToken ct) =>
        db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<UserDto?> GetDtoByIdAsync(Guid id, CancellationToken ct) =>
        db.Users.AsNoTracking()
            .Where(u => u.Id == id)
            .Select(u => new UserDto(u.Id, u.Email.Value, u.RegisteredAt, u.EmailVerifiedAt != null, u.DisplayName))
            .FirstOrDefaultAsync(ct);

    public async Task RemoveWithTokensAsync(User user, CancellationToken ct)
    {
        var tokens = await db.RefreshTokens.Where(t => t.UserId == user.Id).ToListAsync(ct);
        db.RefreshTokens.RemoveRange(tokens);
        db.Users.Remove(user);
    }

    public async Task<PagedResult<UserDto>> ListAsync(string? q, int page, int pageSize, CancellationToken ct)
    {
        var query = db.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(u => EF.Functions.Like(u.Email.Value, $"%{q.Trim()}%"));

        var total = await query.LongCountAsync(ct);
        var items = await query
            .OrderByDescending(u => u.RegisteredAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserDto(u.Id, u.Email.Value, u.RegisteredAt, u.EmailVerifiedAt != null, u.DisplayName))
            .ToListAsync(ct);

        return new PagedResult<UserDto>(page, pageSize, total, items);
    }

    public Task<User?> GetWithRolesAsync(Guid id, CancellationToken ct) =>
        db.Users.Include(u => u.Roles).FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<Role?> GetRoleByNameAsync(string name, CancellationToken ct) =>
        db.Roles.FirstOrDefaultAsync(r => r.Name == name, ct);

    public Task SaveChangesAsync(CancellationToken ct) => db.SaveChangesAsync(ct);
}
