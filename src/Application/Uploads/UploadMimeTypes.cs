namespace Application.Uploads;

// The MIME types accepted for uploads. Kept in one place so the direct (presign and confirm) and
// multipart paths agree.
public static class UploadMimeTypes
{
    private static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        "video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo",
        "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "audio/mp4", "audio/aac",
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain", "text/markdown", "text/csv",
    };

    // Raster images only. SVG is left out because an SVG file can carry script.
    private static readonly HashSet<string> ThumbnailTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/gif",
    };

    // Any type accepted for a lesson file.
    public static bool IsAllowed(string? mime) => Allowed.Contains(Normalize(mime));

    public static bool IsThumbnail(string? mime) => ThumbnailTypes.Contains(Normalize(mime));

    public static bool IsVideo(string? mime) => Normalize(mime).StartsWith("video/", StringComparison.OrdinalIgnoreCase);

    // "image/png; charset=binary" -> "image/png"
    private static string Normalize(string? mime) =>
        string.IsNullOrWhiteSpace(mime) ? "" : mime.Split(';')[0].Trim();
}
