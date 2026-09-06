using Api.Authorization;
using Application.Abstractions;
using Shared.Abstractions;
using Application.Uploads;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Controllers;

// Course thumbnail and intro-video: creator uploads (multipart) and public-ish serving
// (streamed or presigned). File I/O stays in the controller; persistence is delegated.
[ApiController]
[Route("api/courses/{id:guid}")]
[Authorize]
public sealed class CourseMediaController(
    IUploadService uploads,
    ICurrentUser currentUser,
    IStorage storage) : ControllerBase
{
    [HttpPut("thumbnail")]
    [EnableRateLimiting("upload")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadThumbnail(Guid id, IFormFile file, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();

        var owner = await uploads.GetCourseOwnerAsync(id, ct);
        if (owner is null) return NotFound();
        if (owner.Value != userId) return Forbid();

        if (file is null || file.Length <= 0)
            return BadRequest(new { error = "Missing image file." });

        const long maxBytes = 5L * 1024 * 1024; // 5 MB
        if (file.Length > maxBytes)
            return BadRequest(new { error = "Image must be 5 MB or smaller." });

        var mime = string.IsNullOrWhiteSpace(file.ContentType) ? "" : file.ContentType.ToLowerInvariant();
        if (mime is not ("image/jpeg" or "image/png" or "image/webp" or "image/gif"))
            return BadRequest(new { error = "Only JPEG, PNG, WebP, or GIF images are accepted." });

        await using var stream = file.OpenReadStream();
        var safeName = Path.GetFileName(string.IsNullOrWhiteSpace(file.FileName) ? "thumbnail.jpg" : file.FileName);
        var storageKey = await storage.SaveAsync(userId, safeName, mime, stream, ct);

        var thumbnailFileId = await uploads.SetThumbnailAsync(id, userId, storageKey, safeName, file.Length, mime, ct);
        return Ok(new { thumbnailFileId });
    }

    [HttpPut("intro-video")]
    [EnableRateLimiting("upload")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadIntroVideo(Guid id, IFormFile file, CancellationToken ct)
    {
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();

        var owner = await uploads.GetCourseOwnerAsync(id, ct);
        if (owner is null) return NotFound();
        if (owner.Value != userId) return Forbid();

        if (file is null || file.Length <= 0)
            return BadRequest(new { error = "Missing video file." });

        const long maxBytes = 500L * 1024 * 1024; // 500 MB
        if (file.Length > maxBytes)
            return BadRequest(new { error = "Video must be 500 MB or smaller." });

        var mime = string.IsNullOrWhiteSpace(file.ContentType) ? "" : file.ContentType.ToLowerInvariant();
        if (!mime.StartsWith("video/"))
            return BadRequest(new { error = "Only video files are accepted." });

        await using var stream = file.OpenReadStream();
        var safeName = Path.GetFileName(string.IsNullOrWhiteSpace(file.FileName) ? "intro.mp4" : file.FileName);
        var storageKey = await storage.SaveAsync(userId, safeName, mime, stream, ct);

        var introVideoFileId = await uploads.SetIntroVideoAsync(id, userId, storageKey, safeName, file.Length, mime, ct);
        return Ok(new { introVideoFileId });
    }

    [HttpGet("intro-video")]
    public async Task<IActionResult> GetIntroVideo(Guid id, CancellationToken ct)
    {
        var fileId = await uploads.GetIntroVideoFileIdAsync(id, ct);
        if (fileId is null) return NotFound();

        var signedUrl = await storage.TryGetSignedReadUrl(fileId.Value, new SignedReadOptions
        {
            Disposition = "inline",
            Expires = TimeSpan.FromMinutes(60),
        }, ct);
        if (signedUrl is not null) return Redirect(signedUrl);

        Stream stream;
        FileMeta meta;
        try
        {
            stream = await storage.OpenReadAsync(fileId.Value, ct);
            meta = await storage.GetMetadataAsync(fileId.Value, ct);
        }
        catch (FileNotFoundException)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "public, max-age=3600";
        return File(stream, meta.Mime);
    }

    [HttpGet("thumbnail")]
    public async Task<IActionResult> GetThumbnail(Guid id, CancellationToken ct)
    {
        var fileId = await uploads.GetThumbnailFileIdAsync(id, ct);
        if (fileId is null) return NotFound();

        var signedUrl = await storage.TryGetSignedReadUrl(fileId.Value, new SignedReadOptions
        {
            Disposition = "inline",
            Expires = TimeSpan.FromMinutes(30),
        }, ct);
        if (signedUrl is not null) return Redirect(signedUrl);

        Stream stream;
        FileMeta meta;
        try
        {
            stream = await storage.OpenReadAsync(fileId.Value, ct);
            meta = await storage.GetMetadataAsync(fileId.Value, ct);
        }
        catch (FileNotFoundException)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "public, max-age=86400";
        return File(stream, meta.Mime);
    }
}
