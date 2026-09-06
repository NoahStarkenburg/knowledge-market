using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Application.Abstractions;
using Application.Cart;
using Domain.Cart;
using Infrastructure.Catalog;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Cart
{
    public sealed class CartRepository(CartDbContext carts, CatalogDbContext courses) : ICartRepository
    {

        public void AddCart(Domain.Cart.Cart cart)
        {
            carts.Add(cart);
        }

        public async Task<IReadOnlyList<CartCourseInfo>> GetCartCoursesInfoAsync(IReadOnlyList<Guid> courseIds, CancellationToken ct)
        {
            IReadOnlyList<CartCourseInfo> cartCourseInfos = await courses.Courses.AsNoTracking()
                .Where(c => courseIds.Contains(c.Id))
                .Select(c => new CartCourseInfo(c.Id, c.Title.Value, c.Price.Amount, c.Price.Currency, c.PublishedAt != null, c.ThumbnailFileId))
                .ToListAsync(ct);

            return cartCourseInfos;
        }

        public Task<Domain.Cart.Cart?> GetTrackedCartForBuyerAsync(Guid buyerId, CancellationToken ct) =>
            carts.Carts
                .Include(c => c.Items)
                .FirstOrDefaultAsync(c => c.BuyerId == buyerId, ct);

        public Task SaveChangesAsync(CancellationToken ct)
        {
            return carts.SaveChangesAsync(ct);
        }
    }
}
