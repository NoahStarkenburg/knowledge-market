using Api.Auth;
using Api.Auth.AccessService;
using Api.Auth.Resources;
using Application.Content;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/courses/{courseId:guid}/lessons/{lessonId:guid}/texts")]
[Authorize]
public sealed class LessonTextsController(
    ILessonTextService texts,
    ICurrentUser currentUser,
    IAccessService accessService) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(Guid courseId, Guid lessonId, [FromBody] CreateLessonTextRequest req, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        var dto = await texts.CreateAsync(courseId, lessonId, userId, req, ct);
        return Created($"/api/courses/{courseId}/lessons/{lessonId}/texts/{dto.Id}", dto);
    }

    [HttpGet]
    public async Task<IActionResult> List(Guid courseId, Guid lessonId, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);

        var shell = await texts.GetLessonShellAsync(courseId, lessonId, ct);
        if (shell is null) return NotFound();

        var resource = new LessonShell(shell.Id, shell.CourseId, shell.OwnerId, shell.IsFreePreview);
        if (!await accessService.CanViewLesson(userId, resource, ct)) return Forbid();

        var items = await texts.ListAsync(lessonId, ct);
        return Ok(new { items });
    }

    [HttpPatch("{textId:guid}")]
    public async Task<IActionResult> Update(Guid courseId, Guid lessonId, Guid textId, [FromBody] UpdateLessonTextRequest req, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        var dto = await texts.UpdateAsync(lessonId, textId, userId, req, ct);
        return Ok(dto);
    }

    [HttpDelete("{textId:guid}")]
    public async Task<IActionResult> Delete(Guid courseId, Guid lessonId, Guid textId, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        await texts.DeleteAsync(lessonId, textId, userId, ct);
        return NoContent();
    }
}
