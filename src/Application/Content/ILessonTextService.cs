namespace Application.Content;

public interface ILessonTextService
{
    Task<LessonAuthShell?> GetLessonShellAsync(Guid courseId, Guid lessonId, CancellationToken ct);
    Task<LessonTextDto> CreateAsync(Guid courseId, Guid lessonId, Guid userId, CreateLessonTextRequest req, CancellationToken ct);
    Task<IReadOnlyList<LessonTextDto>> ListAsync(Guid lessonId, CancellationToken ct);
    Task<LessonTextDto> UpdateAsync(Guid lessonId, Guid textId, Guid userId, UpdateLessonTextRequest req, CancellationToken ct);
    Task DeleteAsync(Guid lessonId, Guid textId, Guid userId, CancellationToken ct);
}
