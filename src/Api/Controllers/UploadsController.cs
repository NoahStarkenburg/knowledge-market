using Api.Authorization;
using Application.Uploads;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Controllers;

// Direct-to-S3 upload flow: mint a presigned PUT URL, then confirm the object landed.
[ApiController]
[Route("api/uploads")]
[Authorize]
public sealed class UploadsController(
    IUploadService uploads,
    ICurrentUser currentUser) : ControllerBase
{
    [HttpPost("presign")]
    [EnableRateLimiting("upload")]
    public async Task<IActionResult> Presign([FromBody] PresignRequest req, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated) return Unauthorized();
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();

        var result = await uploads.PresignAsync(userId, req, ct);
        return Ok(result);
    }

    [HttpPost("confirm")]
    [EnableRateLimiting("upload")]
    public async Task<IActionResult> Confirm([FromBody] ConfirmRequest req, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated) return Unauthorized();
        var userId = await currentUser.GetRequiredUserIdAsync(ct);
        if (userId == Guid.Empty) return Unauthorized();

        var result = await uploads.ConfirmAsync(userId, req, ct);
        return Ok(result);
    }
}
