using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Contracts.Cart
{
    public sealed record CartItemDto(Guid CourseId, string Title, decimal PriceAmount, string PriceCurrency, Guid? ThumbnailFileId);

}
