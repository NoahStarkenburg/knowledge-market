using Api.Auth;
using Application.Cart;
using Domain.Contracts.Cart;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    [Route("api/cart")]
    [ApiController]
    [Authorize]
    public class CartsController(ICartService carts, ICurrentUser users) : ControllerBase
    {

        [HttpPost("items")]
        public async Task<IActionResult> AddToCart(
            [FromBody] AddToCartRequest addToCartRequest,
            CancellationToken ct)
        {
            var user = await users.GetRequiredUserIdAsync(ct);
            var dto = await carts.AddToCartAsync(addToCartRequest, user, ct);
            return Ok(dto);
        }

        [HttpGet]
        public async Task<IActionResult> GetCart(
            CancellationToken ct)
        {
            var user = await users.GetRequiredUserIdAsync(ct);
            var dto = await carts.GetCartAsync(user, ct);
            return Ok(dto);
        }

        [HttpDelete]
        public async Task<IActionResult> ClearCart(
            CancellationToken ct)
        {
            var user = await users.GetRequiredUserIdAsync(ct);
            var cart = await carts.ClearAsync(user, ct);
            return Ok(cart);
        }

        [HttpPost("checkout")]
        public async Task<IActionResult> CheckoutCart(
            CancellationToken ct)
        {
            var user = await users.GetRequiredUserIdAsync(ct);
            var cart = await carts.CheckoutAsync(user, ct);
            return Ok(cart);
        }

        [HttpDelete("items/{courseId:guid}")]
        public async Task<IActionResult> RemoveFromCart(Guid courseId, CancellationToken ct)
        {
            var user = await users.GetRequiredUserIdAsync(ct);
            var deletedItem = await carts.RemoveFromCartAsync(user, courseId, ct);
            return Ok(deletedItem);
        }
    }
}
