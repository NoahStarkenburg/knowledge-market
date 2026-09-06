using Api.Auth;
using Api.Auth.AccessService;
using Api.Auth.Resources;
using Application.Content;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/courses/{courseId:guid}/lessons/{lessonId:guid}/assets")]
[Authorize]
public sealed class LessonAssetsController(
    ILessonAssetService assets,
    ICurrentUser currentUser,
    IAccessService accessService) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Attach(Guid courseId, Guid lessonId, [FromBody] AttachAssetRequest req, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        var dto = await assets.AttachAsync(courseId, lessonId, userId, req, ct);
        return Created($"/api/courses/{courseId}/lessons/{lessonId}/assets/{dto.Id}", dto);
    }

    [HttpGet]
    public async Task<IActionResult> List(Guid courseId, Guid lessonId, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);

        var shell = await assets.GetLessonShellAsync(courseId, lessonId, ct);
        if (shell is null) return NotFound();

        var resource = new LessonShell(shell.Id, shell.CourseId, shell.OwnerId, shell.IsFreePreview);
        if (!await accessService.CanViewLesson(userId, resource, ct)) return Forbid();

        var items = await assets.ListAsync(lessonId, ct);
        return Ok(new { items });
    }

    [HttpPatch("{assetId:guid}")]
    public async Task<IActionResult> Update(Guid courseId, Guid lessonId, Guid assetId, [FromBody] UpdateAssetRequest req, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        await assets.UpdateAsync(courseId, lessonId, assetId, userId, req, ct);
        return NoContent();
    }

    [HttpDelete("{assetId:guid}")]
    public async Task<IActionResult> Delete(Guid courseId, Guid lessonId, Guid assetId, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        await assets.DeleteAsync(courseId, lessonId, assetId, userId, ct);
        return NoContent();
    }
}
