using Api.Authorization;
using Api.Authorization.Resources;
using Api.Authorization.Policies;
using Application.Abstractions;
using Application.Content;
using Application.Uploads;
using Domain.Contracts.Content;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Controllers;

[ApiController]
[Route("api/courses/{courseId:guid}/lessons")]
[Authorize]
public sealed class LessonsController(
    ILessonService lessons,
    ICurrentUser currentUser,
    IAuthorizationService authz,
    IStorage storage) : ControllerBase
{
    // ---- Lessons ----

    [HttpPost]
    public async Task<IActionResult> Create(Guid courseId, [FromBody] CreateLessonRequest req, CancellationToken ct)
    {
        var course = await lessons.GetCourseShellAsync(courseId, ct);
        if (course is null) return NotFound();
        if (!await AuthorizeCourse(course, PolicyNames.CourseManageContent)) return Forbid();

        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();

        var id = await lessons.CreateLessonAsync(courseId, req, userId, ct);
        return Created($"/api/courses/{courseId}/lessons/{id}", new { id });
    }

    [HttpGet]
    public async Task<IActionResult> List(Guid courseId, CancellationToken ct)
    {
        var course = await lessons.GetCourseShellAsync(courseId, ct);
        if (course is null) return NotFound();
        if (!await AuthorizeCourse(course, PolicyNames.CourseView)) return Forbid();

        var items = await lessons.ListLessonsAsync(courseId, ct);
        return Ok(new { items });
    }

    [HttpGet("{lessonId:guid}")]
    public async Task<IActionResult> GetLesson(Guid courseId, Guid lessonId, CancellationToken ct)
    {
        var row = await lessons.GetLessonMetaAsync(courseId, lessonId, ct);
        if (row is null) return NotFound();

        var shell = new LessonAuthShell(row.Id, row.CourseId, row.OwnerId, row.IsFreePreview);
        if (!await AuthorizeLesson(shell, PolicyNames.LessonView)) return Forbid();

        return Ok(new LessonMetaDto(row.Id, row.Title, row.IsFreePreview, row.CreatedAt));
    }

    [HttpGet("{lessonId:guid}/content")]
    public async Task<IActionResult> GetLessonContent(Guid courseId, Guid lessonId, CancellationToken ct)
    {
        var row = await lessons.GetLessonMetaAsync(courseId, lessonId, ct);
        if (row is null) return NotFound();

        var shell = new LessonAuthShell(row.Id, row.CourseId, row.OwnerId, row.IsFreePreview);
        if (!await AuthorizeLesson(shell, PolicyNames.LessonView)) return Forbid();

        var content = await lessons.GetLessonContentAsync(lessonId, ct);
        if (content is null) return NotFound();

        return Ok(content);
    }

    [HttpPatch("{lessonId:guid}")]
    public async Task<IActionResult> Update(Guid courseId, Guid lessonId, [FromBody] UpdateLessonRequest req, CancellationToken ct)
    {
        var course = await lessons.GetCourseShellAsync(courseId, ct);
        if (course is null) return NotFound();
        if (!await AuthorizeCourse(course, PolicyNames.CourseManageContent)) return Forbid();

        await lessons.UpdateLessonAsync(courseId, lessonId, req, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid courseId, Guid id, CancellationToken ct)
    {
        var shell = await lessons.GetLessonShellByIdAsync(id, ct);
        if (shell is null) return NoContent();
        if (!await AuthorizeLesson(shell, PolicyNames.LessonDelete)) return Forbid();

        await lessons.DeleteLessonAsync(id, ct);
        return NoContent();
    }

    // ---- Uploads ----

    [HttpPost("upload")]
    [EnableRateLimiting("upload")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Upload(Guid courseId, IFormFile file, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated) return Unauthorized();
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();

        if (file is null) return BadRequest(new { error = "missing file", field = "file" });
        if (file.Length <= 0) return BadRequest(new { error = "empty file", field = "file" });

        const long maxSizeBytes = 500L * 1024L * 1024L; // 500 MB
        if (file.Length > maxSizeBytes)
            return BadRequest(new { error = "file too large", maxBytes = maxSizeBytes });

        var contentType = string.IsNullOrWhiteSpace(file.ContentType)
            ? "application/octet-stream"
            : file.ContentType;

        if (!UploadMimeTypes.IsAllowed(contentType))
            return BadRequest(new { error = "unsupported mime type", mime = contentType });

        var safeName = Path.GetFileName(string.IsNullOrWhiteSpace(file.FileName) ? "upload.bin" : file.FileName);

        await using var stream = file.OpenReadStream();
        var storageKey = await storage.SaveAsync(userId, safeName, contentType, stream, ct);

        var dto = await lessons.RegisterUploadedFileAsync(userId, storageKey, safeName, file.Length, contentType, ct);
        return Created($"/api/content/files/{dto.Id}", dto);
    }

    [HttpGet("{lessonId:guid}/files/{fileId:guid}/download")]
    public async Task<IActionResult> Download(
        Guid courseId, Guid lessonId, Guid fileId, [FromQuery] bool inline, CancellationToken ct)
    {
        var shell = await lessons.GetAssetDownloadShellAsync(courseId, lessonId, fileId, ct);
        if (shell is null)
            return NotFound(new { reason = "no lesson asset mapping", lessonId, fileId, courseId });

        if (!await AuthorizeLesson(shell, PolicyNames.LessonView)) return Forbid();

        // Try presigned redirect (S3/MinIO) — skips proxying through the API.
        try
        {
            var signedUrl = await storage.TryGetSignedReadUrl(fileId, new SignedReadOptions
            {
                Disposition = inline ? "inline" : "attachment",
                FileName = null,
                Expires = TimeSpan.FromMinutes(10),
            }, ct);

            if (signedUrl is not null) return Redirect(signedUrl);
        }
        catch (FileNotFoundException)
        {
            return NotFound(new { reason = "file missing", fileId });
        }

        FileMeta meta;
        Stream stream;
        try
        {
            meta = await storage.GetMetadataAsync(fileId, ct);
            stream = await storage.OpenReadAsync(fileId, ct);
        }
        catch (FileNotFoundException)
        {
            return NotFound(new { reason = "file missing", fileId });
        }

        var tagValue = $"{fileId:N}-{meta.Size}";
        var etag = new Microsoft.Net.Http.Headers.EntityTagHeaderValue($"\"{tagValue}\"", isWeak: true);

        Response.Headers.ETag = etag.ToString();
        Response.Headers.LastModified = meta.LastModifiedUtc.ToString("R");

        var requestHeaders = Request.GetTypedHeaders();
        if (requestHeaders.IfNoneMatch?.Any(x => x.Tag == etag.Tag) == true)
            return StatusCode(StatusCodes.Status304NotModified);

        return File(stream, meta.Mime, inline ? null : meta.FileName, meta.LastModifiedUtc, etag, enableRangeProcessing: true);
    }

    [HttpDelete("upload/{fileId:guid}")]
    public async Task<IActionResult> DeleteStagedFile(Guid courseId, Guid fileId, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated) return Unauthorized();
        var userId = await currentUser.GetRequiredUserIdAsync(ct);

        if (!await lessons.IsUploadOwnedByUserAsync(fileId, userId, ct)) return NotFound();

        try
        {
            await storage.DeleteAsync(fileId, ct);
            return NoContent();
        }
        catch (FileNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // ---- Reorder ----

    [HttpPatch("reorder")]
    public async Task<IActionResult> ReorderLessons(Guid courseId, [FromBody] BulkReorderRequest body, CancellationToken ct)
    {
        var course = await lessons.GetCourseShellAsync(courseId, ct);
        if (course is null) return NotFound();
        if (!await AuthorizeCourse(course, PolicyNames.CourseManageContent)) return Forbid();

        await lessons.ReorderLessonsAsync(courseId, body.Items, ct);
        return NoContent();
    }

    [HttpPatch("{lessonId:guid}/reorder")]
    public async Task<IActionResult> ReorderLessonContent(Guid courseId, Guid lessonId, [FromBody] BulkReorderRequest body, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        await lessons.ReorderLessonContentAsync(courseId, lessonId, userId, body.Items, ct);
        return NoContent();
    }

    // ---- Progress ----

    [HttpPost("{lessonId:guid}/complete")]
    public async Task<IActionResult> MarkComplete(Guid courseId, Guid lessonId, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        await lessons.MarkLessonCompleteAsync(userId, courseId, lessonId, ct);
        return NoContent();
    }

    [HttpDelete("{lessonId:guid}/complete")]
    public async Task<IActionResult> UnmarkComplete(Guid courseId, Guid lessonId, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        await lessons.UnmarkLessonCompleteAsync(userId, lessonId, ct);
        return NoContent();
    }

    [HttpGet("progress")]
    public async Task<IActionResult> GetProgress(Guid courseId, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        var completedLessonIds = await lessons.GetCompletedLessonIdsAsync(userId, courseId, ct);
        return Ok(new { completedLessonIds });
    }

    // ---- Helpers ----

    private async Task<bool> AuthorizeCourse(CourseAuthShell shell, string policy)
    {
        var result = await authz.AuthorizeAsync(User, new CourseShell(shell.Id, shell.OwnerId, shell.IsPublished), policy);
        return result.Succeeded;
    }

    private async Task<bool> AuthorizeLesson(LessonAuthShell shell, string policy)
    {
        var result = await authz.AuthorizeAsync(User, new LessonShell(shell.Id, shell.CourseId, shell.OwnerId, shell.IsFreePreview), policy);
        return result.Succeeded;
    }
}
