using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Contracts.Identity
{
    public sealed record UserRegisteredV1(Guid UserId, string Email, DateTimeOffset OccurredAt);
}
