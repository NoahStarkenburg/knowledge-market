using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Contracts.Orders
{
    public sealed record OrderDto(
    
        Guid Id,
        Guid BuyerId,
        Guid CourseId,
        string CourseTitle,
        decimal PriceAmount,
        string PriceCurrency,
        string Status,
        DateTimeOffset CreatedAt,
        DateTimeOffset? PaidAt
    );
}
