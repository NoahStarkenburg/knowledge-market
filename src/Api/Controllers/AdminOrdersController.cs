using Application.Orders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Policy = "role:admin")]
public sealed class AdminOrdersController(IOrderService orders) : ControllerBase
{
    [HttpGet("orders")]
    public async Task<IActionResult> ListOrders(
        [FromQuery] string? status,
        [FromQuery] string? q,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await orders.AdminListAsync(status, q, from, to, page, pageSize, ct);
        return Ok(new { result.Page, result.PageSize, result.Total, result.Items });
    }
}
