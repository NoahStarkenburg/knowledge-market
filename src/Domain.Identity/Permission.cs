using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Identity
{
    public sealed class Permission
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = default!;
        public string? Description { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public ICollection<Role> Roles { get; set; } = new List<Role>();
    }
}
