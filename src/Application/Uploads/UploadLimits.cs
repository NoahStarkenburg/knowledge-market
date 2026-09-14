namespace Application.Uploads;

// Upload size limits, shared by the direct path (checked on confirm against the size storage
// reports) and the multipart path through the API, so both enforce the same numbers.
public static class UploadLimits
{
    public const long LessonFileBytes = 500L * 1024 * 1024;
    public const long ThumbnailBytes = 5L * 1024 * 1024;
    public const long IntroVideoBytes = 500L * 1024 * 1024;

    // Room for multipart boundaries and part headers on top of the file itself, when raising
    // Kestrel's request limits for a multipart endpoint.
    public const long MultipartOverheadBytes = 1L * 1024 * 1024;
}
