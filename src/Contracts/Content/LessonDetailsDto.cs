namespace Contracts.Content;

public sealed record LessonContentDto(
    Guid LessonId,
    Guid CourseId,
    string Title,
    bool IsFreePreview,
    IReadOnlyList<LessonContentItemDto> Items
);

/// <summary>
/// One item in the lesson content timeline: either a text block or a file attachment.
/// </summary>
public sealed record LessonContentItemDto(
    Guid Id,
    string Kind,            // "text" or "document"
    string Title,
    int SortOrder,
    DateTimeOffset CreatedAt,
    // Text-only fields
    string? Text,
    // File-only fields
    string? StorageKey,
    string? FileTitle,
    string? MimeType,
    long? FileSize,
    Guid? ContentFileId
);
