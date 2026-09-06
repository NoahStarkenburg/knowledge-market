using Application.Catalog;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/catalog")]
[AllowAnonymous]
public sealed class PublicCatalogController(ICourseService courses) : ControllerBase
{
    [HttpGet("featured")]
    public async Task<IActionResult> Featured([FromQuery] int count, CancellationToken ct) =>
        Ok(await courses.FeaturedAsync(count, ct));

    [HttpGet("by-creator/{creatorId:guid}")]
    public async Task<IActionResult> ByCreator(
        Guid creatorId,
        [FromQuery] Guid? exclude,
        [FromQuery] int count,
        CancellationToken ct) =>
        Ok(await courses.ByCreatorAsync(creatorId, exclude, count, ct));

    [HttpGet("stats")]
    public async Task<IActionResult> Stats(CancellationToken ct)
    {
        var stats = await courses.CatalogStatsAsync(ct);
        return Ok(new { publishedCourses = stats.PublishedCourses, creators = stats.Creators });
    }
}
