using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Domain.Identity;
using Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace Api.Auth;

public interface ITokenService
{
    Task<string> Create(Guid userId, string email);
    Task<string> CreateRefreshTokenAsync(Guid userId, CancellationToken ct = default);
    Task<(Guid UserId, string NewRefreshToken)?> RotateRefreshTokenAsync(string rawToken, CancellationToken ct = default);
    Task RevokeRefreshTokenAsync(string rawToken, CancellationToken ct = default);
}

public sealed class TokenService(IConfiguration cfg, UsersDbContext usersDb) : ITokenService
{
    private static readonly TimeSpan RefreshTokenLifetime = TimeSpan.FromDays(7);

    public async Task<string> Create(Guid userId, string email)
    {
        var jwt = cfg.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["SigningKey"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var (roles, perms) = await GetAuthGrantedAsync(userId);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(JwtRegisteredClaimNames.Email, email),
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Email, email),
        };

        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
        claims.AddRange(perms.Select(p => new Claim("perm", p)));

        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"],
            audience: jwt["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<string> CreateRefreshTokenAsync(Guid userId, CancellationToken ct = default)
    {
        var (entity, raw) = RefreshToken.Create(userId, RefreshTokenLifetime);
        usersDb.RefreshTokens.Add(entity);
        await usersDb.SaveChangesAsync(ct);
        return raw;
    }

    public async Task<(Guid UserId, string NewRefreshToken)?> RotateRefreshTokenAsync(string rawToken, CancellationToken ct = default)
    {
        var hash = RefreshToken.Hash(rawToken);
        var existing = await usersDb.RefreshTokens
            .FirstOrDefaultAsync(t => t.Token == hash, ct);

        if (existing is null || !existing.IsActive)
            return null;

        existing.Revoke();

        var (newEntity, newRaw) = RefreshToken.Create(existing.UserId, RefreshTokenLifetime);
        usersDb.RefreshTokens.Add(newEntity);
        await usersDb.SaveChangesAsync(ct);

        return (existing.UserId, newRaw);
    }

    public async Task RevokeRefreshTokenAsync(string rawToken, CancellationToken ct = default)
    {
        var hash = RefreshToken.Hash(rawToken);
        var existing = await usersDb.RefreshTokens
            .FirstOrDefaultAsync(t => t.Token == hash, ct);

        if (existing is null || !existing.IsActive) return;

        existing.Revoke();
        await usersDb.SaveChangesAsync(ct);
    }

    private async Task<(string[] Roles, string[] Perms)> GetAuthGrantedAsync(Guid userId, CancellationToken ct = default)
    {
        var roles = await usersDb.Users
            .Where(u => u.Id == userId)
            .SelectMany(u => u.Roles.Select(r => r.Name))
            .Distinct()
            .ToArrayAsync(ct);

        var perms = await usersDb.Users
            .Where(u => u.Id == userId)
            .SelectMany(u => u.Roles.SelectMany(r => r.Permissions.Select(p => p.Name)))
            .Distinct()
            .ToArrayAsync(ct);

        return (roles, perms);
    }
}
