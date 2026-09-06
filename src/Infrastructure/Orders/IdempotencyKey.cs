using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Infrastructure.Orders
{
    public sealed class IdempotencyKey
    {
        public Guid Id { get; set; }
        public Guid BuyerId { get; set; }
        public string Key { get; set; }
        public Guid OrderId { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }
}
