using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Contracts.Identity
{
    public sealed record UserDto(
        Guid Id,
        string Email,
        DateTimeOffset RegisteredAt,
        bool IsEmailVerified,
        string? DisplayName = null
    );
}
