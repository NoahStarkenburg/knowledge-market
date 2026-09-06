using Contracts.Identity;
using Domain.Identity;
using System.Linq.Expressions;

namespace Api.Mappings
{
    public static class UserMappings
    {
        // EF-translatable projection (use in queries: .Select(UserMappings.ToDtoProjection))
        public static readonly Expression<Func<User, UserDto>> ToDtoProjection =
            u => new UserDto(u.Id, u.Email.Value, u.RegisteredAt, u.EmailVerifiedAt != null, u.DisplayName);

        // In-memory mapping (after commands)
        public static UserDto ToDto(this User u) =>
            new UserDto(u.Id, u.Email.Value, u.RegisteredAt, u.IsEmailVerified, u.DisplayName);
    }
}
