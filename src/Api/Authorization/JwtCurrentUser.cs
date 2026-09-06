using System.Security.Claims;
using Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Api.Auth
{
    public sealed class JwtCurrentUser : ICurrentUser
    {
        private readonly IHttpContextAccessor _http;
        private readonly UsersDbContext _users;

        public JwtCurrentUser(IHttpContextAccessor http, UsersDbContext users)
        {
            _http = http;
            _users = users;
        }

        public bool IsAuthenticated => _http.HttpContext?.User?.Identity?.IsAuthenticated == true;//

        public string? Email
        {
            get
            {
                var u = _http.HttpContext?.User;
                return u?.FindFirstValue(ClaimTypes.Email) ?? u?.FindFirstValue("email");
            }
        }

        public async Task<Guid> GetUserIdAsync(CancellationToken ct = default)
        {
            var u = _http.HttpContext?.User;
            // Prefer sub as GUID:
            var sub = u?.FindFirstValue(ClaimTypes.NameIdentifier) ?? u?.FindFirstValue("sub");
            if (Guid.TryParse(sub, out var id) && id != Guid.Empty) return id;

            // Fallback by email (slower DB hit, but works if token has email only)
            if (Email is null) return Guid.Empty;

            var normalized = Domain.Identity.Email.Create(Email).Value;
            return await _users.Users.AsNoTracking()
                .Where(x => x.Email.Value == normalized)//
                .Select(x => x.Id)
                .FirstOrDefaultAsync(ct);
        }

        public async Task<Guid> GetRequiredUserIdAsync(CancellationToken ct = default)
        {
            var id = await GetUserIdAsync(ct);
            if (id == Guid.Empty) throw new UnauthorizedAccessException("JWT subject not recognized");
            return id;
        }
    }
}
