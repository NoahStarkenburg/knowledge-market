using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Application.Orders;
using Domain.Contracts.Cart;

namespace Application.Cart
{
    public interface ICartService
    {
        Task<CartDto> GetCartAsync(Guid buyerId, CancellationToken ct);
        Task<CartDto> AddToCartAsync(AddToCartRequest addToCartRequest, Guid buyerId, CancellationToken ct);
        Task<CartDto> RemoveFromCartAsync(Guid buyerId, Guid courseId, CancellationToken ct);
        Task<CartDto> ClearAsync(Guid buyerId, CancellationToken ct);
        Task<CartCheckoutResult> CheckoutAsync(Guid buyerId, CancellationToken ct);
    }
}
