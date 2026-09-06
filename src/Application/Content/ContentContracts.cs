namespace Application.Content;

// Authorization shells surfaced to controllers so they can run resource-based policies
// without the Application layer taking a dependency on ASP.NET authorization.
public sealed record CourseAuthShell(Guid Id, Guid OwnerId, bool IsPublished);
public sealed record LessonAuthShell(Guid Id, Guid CourseId, Guid OwnerId, bool IsFreePreview);

// Lesson metadata plus the fields a controller needs to authorize before returning it.
public sealed record LessonMetaRow(Guid Id, Guid CourseId, Guid OwnerId, bool IsFreePreview, string Title, DateTimeOffset CreatedAt);

// Projection of a staged upload row (the ContentFile entity itself stays in Infrastructure).
public sealed record ContentFileInfo(Guid Id, string FileTitle, string MimeType, long FileSize);

// ---- Requests ----
public sealed record UpdateLessonRequest(string? Title, bool? IsFreePreview, string? Body);
public sealed record AttachAssetRequest(Guid ContentFileId, string Title, int SortOrder);
public sealed record UpdateAssetRequest(string Title, int SortOrder);
public sealed record CreateLessonTextRequest(string Title, string BodyMarkdown);
public sealed record UpdateLessonTextRequest(string? Title, string? BodyMarkdown);
public sealed record BulkReorderItem(string Kind, Guid Id, int NewSort);
public sealed record BulkReorderRequest(IReadOnlyCollection<BulkReorderItem> Items);

// ---- Responses ----
public sealed record LessonMetaDto(Guid Id, string Title, bool IsFreePreview, DateTimeOffset CreatedAt);

public sealed record LessonAssetDto(
    Guid Id,
    string Title,
    int SortOrder,
    string FileTitle,
    string MimeType,
    long FileSize);

public sealed record LessonTextDto(
    Guid Id,
    Guid LessonId,
    string Title,
    string BodyMarkdown,
    int SortOrder,
    DateTimeOffset CreatedAt);

public sealed record UploadFileResponse(
    Guid Id,
    string FileTitle,
    long FileSize,
    string MimeType,
    string StorageKey);
