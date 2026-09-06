using Application.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Policy = "role:admin")]
public sealed class AdminUsersController(IUserService users) : ControllerBase
{
    [HttpGet("users")]
    public async Task<IActionResult> ListUsers(
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await users.ListUsersAsync(q, page, pageSize, ct);
        return Ok(new { result.Page, result.PageSize, result.Total, result.Items });
    }

    [HttpPost("users/{userId:guid}/roles/{roleName}")]
    public async Task<IActionResult> AssignRole(Guid userId, string roleName, CancellationToken ct)
    {
        var result = await users.AssignRoleAsync(userId, roleName, ct);
        Log.Information("Admin assigned role {Role} to user {UserId}", result.Role, result.UserId);
        return Ok(new { userId = result.UserId, role = result.Role });
    }
}
