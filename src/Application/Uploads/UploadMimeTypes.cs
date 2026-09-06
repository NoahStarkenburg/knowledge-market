namespace Application.Uploads;

// The set of MIME types accepted for staged content uploads (lesson files and
// direct-to-S3 uploads). Kept in one place so the proxy and presign paths agree.
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

    public static bool IsAllowed(string? mime)
    {
        if (string.IsNullOrWhiteSpace(mime)) return false;
        var m = mime.Split(';')[0].Trim();
        return Allowed.Contains(m);
    }
}
