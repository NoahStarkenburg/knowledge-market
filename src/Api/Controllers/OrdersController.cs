using Api.Authorization;
using Application.Orders;
using Domain.Contracts.Orders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]
public sealed class OrdersController(
    IOrderService orders,
    ICurrentUser currentUser,
    IConfiguration cfg,
    IHostEnvironment env) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Purchase(
        [FromHeader(Name = "Idempotency-Key")] string idempotencyKey,
        [FromBody] PurchaseCourseRequest req,
        CancellationToken ct)
    {
        var buyerId = await currentUser.GetRequiredUserIdAsync(ct);
        if (buyerId == Guid.Empty) return Unauthorized();

        var dto = await orders.PurchaseAsync(buyerId, req, idempotencyKey, ct);
        return Created($"/api/orders/{dto.Id}", dto);
    }

    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe(
        [FromHeader(Name = "Idempotency-Key")] string idempotencyKey,
        [FromBody] PurchaseCourseRequest req,
        CancellationToken ct)
    {
        var buyerId = await currentUser.GetRequiredUserIdAsync(ct);
        if (buyerId == Guid.Empty) return Unauthorized();

        var priceId = cfg["Stripe:SubscriptionPriceId"];
        var result = await orders.SubscribeAsync(buyerId, req, idempotencyKey, priceId, ct);

        return result.Idempotent
            ? Created($"/api/orders/subscriptions/{result.Subscription.Id}", result.Subscription)
            : Created($"/api/orders/subscriptions/{result.Subscription.Id}",
                new { subscription = result.Subscription, clientSecret = result.ClientSecret });
    }

    [HttpGet("subscriptions")]
    public async Task<IActionResult> ListSubscriptions(CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();
        var items = await orders.ListSubscriptionsAsync(userId, ct);
        return Ok(new { items });
    }

    [HttpDelete("subscriptions/{id:guid}")]
    public async Task<IActionResult> CancelSubscription(Guid id, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();
        await orders.CancelSubscriptionAsync(userId, id, ct);
        return NoContent();
    }

    [HttpGet("check")]
    public async Task<IActionResult> Check([FromQuery] Guid courseId, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();
        var enrolled = await orders.IsEnrolledAsync(userId, courseId, ct);
        return Ok(new { enrolled });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var buyerId = await currentUser.GetRequiredUserIdAsync(ct);
        if (buyerId == Guid.Empty) return Unauthorized();
        var dto = await orders.GetAsync(id, buyerId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? status,
        [FromQuery] string? q,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var buyerId = await currentUser.GetRequiredUserIdAsync(ct);
        if (buyerId == Guid.Empty) return Unauthorized();
        var result = await orders.ListAsync(buyerId, status, q, from, to, page, pageSize, ct);
        return Ok(new { result.Page, result.PageSize, result.Total, result.Items });
    }

    [HttpPost("{id:guid}/checkout")]
    [EnableRateLimiting("checkout")]
    public async Task<IActionResult> Checkout(Guid id, CancellationToken ct)
    {
        var buyerId = await currentUser.GetRequiredUserIdAsync(ct);
        if (buyerId == Guid.Empty) return Unauthorized();
        var result = await orders.CheckoutAsync(buyerId, id, ct);
        return Ok(new { clientSecret = result.ClientSecret });
    }

    [HttpPost("{id:guid}/refund")]
    [EnableRateLimiting("checkout")]
    public async Task<IActionResult> Refund(Guid id, CancellationToken ct)
    {
        var buyerId = await currentUser.GetRequiredUserIdAsync(ct);
        if (buyerId == Guid.Empty) return Unauthorized();
        var dto = await orders.RefundAsync(buyerId, id, ct);
        return Ok(dto);
    }

    // Dev-only convenience to mark an order paid without going through Stripe.
    [HttpPost("{id:guid}/mark-paid")]
    public async Task<IActionResult> MarkPaid(Guid id, CancellationToken ct)
    {
        if (!env.IsDevelopment()) return NotFound();
        var buyerId = await currentUser.GetRequiredUserIdAsync(ct);
        if (buyerId == Guid.Empty) return Unauthorized();
        var dto = await orders.MarkPaidAsync(buyerId, id, ct);
        return Ok(dto);
    }
}
