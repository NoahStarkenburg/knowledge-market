using Api.Auth;
using Application.Creator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/creator")]
[Authorize]
public sealed class CreatorController(
    ICreatorService creator,
    ICurrentUser currentUser) : ControllerBase
{
    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();

        var dashboard = await creator.GetDashboardAsync(userId, ct);
        return Ok(dashboard);
    }

    [HttpGet("orders")]
    public async Task<IActionResult> Orders(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();

        var result = await creator.ListOrdersAsync(userId, page, pageSize, ct);
        return Ok(new { result.Page, result.PageSize, result.Total, result.Items });
    }
}
