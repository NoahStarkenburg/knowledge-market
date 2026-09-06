using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Application.Abstractions;
using Application.Common;
using Application.Orders;
using Domain.Cart;
using Domain.Contracts.Cart;
using Microsoft.Extensions.Logging;

namespace Application.Cart
{
    public sealed class CartService(ICartRepository carts, IOrderService orders, AppMetrics metrics, ILogger<CartService> log) : ICartService
    {
        private async Task<CartDto> ToDtoAsync(Domain.Cart.Cart cart, CancellationToken ct)
        {
            IReadOnlyList<Guid> ids = cart.Items.Select(x => x.CourseId).ToList();
            var infos = await carts.GetCartCoursesInfoAsync(ids, ct);
            decimal total = 0;

            List<CartItemDto> items = new List<CartItemDto>();
            foreach (var item in infos)
            {
                items.Add(new CartItemDto(item.CourseId, item.Title, item.PriceAmount, item.PriceCurrency, item.ThumbnailFileId));
                total += item.PriceAmount;
            }

            return new CartDto(items, total);
        }
        public async Task<CartDto> AddToCartAsync(AddToCartRequest addToCartRequest, Guid buyerId, CancellationToken ct)
        {
            var info = (await carts.GetCartCoursesInfoAsync(new[] { addToCartRequest.CourseId }, ct)).FirstOrDefault();
            if (info is null)
                throw new NotFoundException("Course not found.");
            if (!info.IsPublished)
                throw new BadRequestException("Course must be published.");

            if (await orders.IsEnrolledAsync(buyerId, addToCartRequest.CourseId, ct))
                throw new ConflictException("You already own this course");

            var cart = await carts.GetTrackedCartForBuyerAsync(buyerId, ct);
            if (cart is null)
            {
                cart = Domain.Cart.Cart.CreateCart(buyerId);
                carts.AddCart(cart);
            }

            cart.AddItem(addToCartRequest.CourseId);
            await carts.SaveChangesAsync(ct);

            metrics.RecordCartItemAdded();
            log.LogInformation("Course {CourseId} added to cart for buyer {BuyerId}", addToCartRequest.CourseId, buyerId);

            return await ToDtoAsync(cart, ct);
        }

        public async Task<CartCheckoutResult> CheckoutAsync(Guid buyerId, CancellationToken ct)
        {
            using var activity = AppDiagnostics.Start("cart.checkout");
            activity?.SetTag("buyer.id", buyerId);

            var cart = await carts.GetTrackedCartForBuyerAsync(buyerId, ct);
            if (cart is null || cart.Items.Count == 0)
                throw new BadRequestException("Cart is empty");

            var orderIds = new List<Guid>();

            foreach (var item in cart.Items.ToList())
            {
                var key = $"cart:{cart.Id}:{item.CourseId}";
                var order = await orders.PurchaseAsync(buyerId, new Domain.Contracts.Orders.PurchaseCourseRequest(item.CourseId), key, ct);
                orderIds.Add(order.Id);
            }

            cart.Clear();
            await carts.SaveChangesAsync(ct);

            activity?.SetTag("cart.item_count", orderIds.Count);
            metrics.RecordCartCheckout(orderIds.Count);
            log.LogInformation("Cart checked out for buyer {BuyerId}: {OrderCount} orders created", buyerId, orderIds.Count);

            return new CartCheckoutResult(orderIds);
        }

        public async Task<CartDto> ClearAsync(Guid buyerId, CancellationToken ct)
        {
            var cart = await carts.GetTrackedCartForBuyerAsync(buyerId, ct);
            if (cart is null) return new CartDto([], 0);

            cart.Clear();
            await carts.SaveChangesAsync(ct);

            return new CartDto([], 0);

        }

        public async Task<CartDto> GetCartAsync(Guid buyerId, CancellationToken ct)
        {
            var cart = await carts.GetTrackedCartForBuyerAsync(buyerId, ct);
            if (cart is null)
            {
                return new CartDto([], 0);
            }

            return await ToDtoAsync(cart, ct);
        }

        public async Task<CartDto> RemoveFromCartAsync(Guid buyerId, Guid courseId, CancellationToken ct)
        {
            var cart = await carts.GetTrackedCartForBuyerAsync(buyerId, ct);
            if (cart is null)
            {
                return new CartDto([], 0);
            }

            cart.RemoveItem(courseId);

            await carts.SaveChangesAsync(ct);
            return await ToDtoAsync(cart, ct);
        }
    }
}
