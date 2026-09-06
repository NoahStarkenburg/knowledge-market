namespace Application.Abstractions;

// Lesson bodies are stored as markdown blobs outside the database. The service layer owns
// this abstraction so it can persist/read bodies without depending on a concrete provider.
public interface IContentStorage
{
    Task<string> SaveLessonBodyAsync(Guid courseId, Guid lessonId, string body, CancellationToken ct);
    Task<string?> ReadLessonBodyAsync(string storagePath, CancellationToken ct);
}
