using Application.Catalog;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Policy = "role:admin")]
public sealed class AdminCatalogController(ICourseService courses) : ControllerBase
{
    // Moderation: delete any review by id (idempotent).
    [HttpDelete("reviews/{id:guid}")]
    public async Task<IActionResult> DeleteReview(Guid id, CancellationToken ct)
    {
        await courses.AdminDeleteReviewAsync(id, ct);
        return NoContent();
    }
}
