using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Contracts.Catalog
{
    public sealed record UpdateCourseRequest(
        string? Title,
        string? Description,
        decimal? PriceAmount,
        string? PriceCurrency,
        string[]? Tags
    );
}
