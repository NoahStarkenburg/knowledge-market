using Api.Authorization;
using Api.Authorization.Resources;
using Api.Authorization.Policies;
using Application.Catalog;
using Domain.Contracts.Catalog;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Controllers;

[ApiController]
[Route("api/courses")]
[Authorize]
public sealed class CoursesController(
    ICourseService courses,
    ICurrentUser currentUser,
    IAuthorizationService authz) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCourseRequest req, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        var dto = await courses.CreateAsync(req, userId, ct);
        return Created($"/api/courses/{dto.Id}", dto);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var view = await courses.GetAsync(id, ct);
        if (view is null) return NotFound();

        // Published courses are visible to any authenticated user; drafts only to owner/admin.
        if (!view.IsPublished)
        {
            var userId = await currentUser.GetUserIdAsync(ct);
            if (!User.IsInRole("Admin") && userId != view.CreatedById) return Forbid();
        }

        return Ok(view.Dto);
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        var result = await courses.ListAsync(User.IsInRole("Admin"), userId, status, page, pageSize, ct);
        return Ok(new { result.Page, result.PageSize, result.Total, result.Items });
    }

    [HttpGet("mycourses")]
    public async Task<IActionResult> MyCourses(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();
        var result = await courses.ListMineAsync(userId, page, pageSize, ct);
        return Ok(new { result.Page, result.PageSize, result.Total, result.Items });
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search(
        [FromQuery] string? q,
        [FromQuery] string? tags,
        [FromQuery] decimal? minPrice,
        [FromQuery] decimal? maxPrice,
        [FromQuery] string? sortBy,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var tagList = tags?.Split(',').Select(t => t.Trim().ToLowerInvariant()).Where(t => t.Length > 0).ToArray();
        if (string.IsNullOrWhiteSpace(q) && (tagList is null || tagList.Length == 0))
            return BadRequest(new { error = "Provide 'q' or 'tags'." });

        var result = await courses.SearchAsync(q, tagList, minPrice, maxPrice, sortBy, page, pageSize, ct);
        return Ok(new { result.Page, result.PageSize, result.Total, result.Items });
    }

    [HttpGet("purchased")]
    public async Task<IActionResult> Purchased(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();
        var result = await courses.ListPurchasedAsync(userId, page, pageSize, ct);
        return Ok(new { result.Page, result.PageSize, result.Total, result.Items });
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCourseRequest req, CancellationToken ct)
    {
        var shell = await courses.GetShellAsync(id, false, ct);
        if (shell is null) return NotFound();
        if (!await AuthorizedAsync(shell, PolicyNames.CourseEdit)) return Forbid();

        var dto = await courses.UpdateAsync(id, req, ct);
        return Ok(dto);
    }

    [HttpPost("{id:guid}/publish")]
    public async Task<IActionResult> Publish(Guid id, CancellationToken ct)
    {
        var shell = await courses.GetShellAsync(id, false, ct);
        if (shell is null) return NotFound();
        if (!await AuthorizedAsync(shell, PolicyNames.CoursePublish)) return Forbid();

        var dto = await courses.PublishAsync(id, ct);
        return Ok(dto);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var shell = await courses.GetShellAsync(id, true, ct);
        if (shell is null) return NoContent();
        if (!await AuthorizedAsync(shell, PolicyNames.CourseDelete)) return Forbid();

        await courses.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/stats")]
    public async Task<IActionResult> Stats(Guid id, CancellationToken ct)
    {
        var shell = await courses.GetShellAsync(id, false, ct);
        if (shell is null) return NotFound();
        if (!await AuthorizedAsync(shell, PolicyNames.CourseEdit)) return Forbid();

        var stats = await courses.CourseStatsAsync(id, ct);
        return Ok(new
        {
            enrollmentCount = stats.EnrollmentCount,
            totalRevenue = stats.TotalRevenue,
            reviewCount = stats.ReviewCount,
            avgRating = stats.AvgRating
        });
    }

    [HttpPost("{id:guid}/reviews")]
    [EnableRateLimiting("review")]
    public async Task<IActionResult> UpsertReview(Guid id, [FromBody] CreateReviewRequest req, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();

        var result = await courses.UpsertReviewAsync(id, userId, req.Rating, req.Comment, ct);
        return result.Created
            ? Created($"/api/courses/{id}/reviews/{result.Review.Id}", result.Review)
            : Ok(result.Review);
    }

    [HttpGet("{id:guid}/reviews")]
    public async Task<IActionResult> ListReviews(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await courses.ListReviewsAsync(id, page, pageSize, ct);
        return Ok(new { result.Page, result.PageSize, total = result.Total, avgRating = result.AvgRating, items = result.Items });
    }

    [HttpDelete("{id:guid}/reviews/mine")]
    public async Task<IActionResult> DeleteOwnReview(Guid id, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();
        await courses.DeleteOwnReviewAsync(id, userId, ct);
        return NoContent();
    }

    private async Task<bool> AuthorizedAsync(CourseShellData shell, string policy)
    {
        var result = await authz.AuthorizeAsync(User, new CourseShell(shell.Id, shell.OwnerId, shell.IsPublished), policy);
        return result.Succeeded;
    }
}

public sealed record CreateReviewRequest(int Rating, string? Comment);
