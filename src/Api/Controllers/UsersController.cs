using Api.Authorization;
using Application.Abstractions;
using Infrastructure.Email;
using Application.Catalog;
using Application.Users;
using Domain.Contracts.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/users")]
public sealed class UsersController(
    IUserService users,
    ICourseService courses,
    ICurrentUser currentUser,
    IEmailService email,
    IConfiguration cfg) : ControllerBase
{
    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] RegisterUserRequest req, CancellationToken ct)
    {
        var result = await users.RegisterAsync(req, ct);

        var frontendUrl = cfg["Cors:FrontendOrigin"] ?? "http://localhost:5173";
        var verifyUrl = $"{frontendUrl}/verify-email?token={Uri.EscapeDataString(result.VerificationToken)}";

        _ = email.SendAsync(result.Email, "Verify your KnowledgeMarket email",
            EmailTemplates.VerifyEmail(verifyUrl), ct);
        _ = email.SendAsync(result.Email, "Welcome to KnowledgeMarket!",
            EmailTemplates.Welcome(result.Email), ct);

        return Created($"/api/users/{result.User.Id}", result.User);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();

        var dto = await users.GetByIdAsync(userId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPatch("me")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();

        var result = await users.UpdateProfileAsync(userId, req, ct);
        if (result is null) return Unauthorized();

        if (result.EmailChanged && result.NewEmail is not null && result.VerificationToken is not null)
        {
            var verifyUrl = $"{Request.Scheme}://{Request.Host}/api/auth/verify-email?token={Uri.EscapeDataString(result.VerificationToken)}";
            _ = email.SendAsync(result.NewEmail, "Verify your new KnowledgeMarket email",
                EmailTemplates.VerifyEmail(verifyUrl), ct);
        }

        return Ok(result.User);
    }

    [HttpDelete("me")]
    [Authorize]
    public async Task<IActionResult> DeleteMe(CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();

        if (!await users.DeleteAsync(userId, ct)) return Unauthorized();

        Response.Cookies.Delete(AuthCookies.AccessTokenCookie, new CookieOptions { Path = "/" });
        Response.Cookies.Delete(AuthCookies.RefreshTokenCookie, new CookieOptions { Path = "/api/auth" });
        Response.Cookies.Delete(AuthCookies.CsrfCookie, new CookieOptions { Path = "/" });

        return Ok(new { ok = true });
    }

    [HttpGet("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var dto = await users.GetByIdAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    // Published courses by a specific creator (public).
    [HttpGet("{id:guid}/courses")]
    [AllowAnonymous]
    public async Task<IActionResult> CreatorCourses(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await courses.ListPublishedByCreatorAsync(id, page, pageSize, ct);
        return Ok(new { result.Page, result.PageSize, result.Total, result.Items });
    }
}
