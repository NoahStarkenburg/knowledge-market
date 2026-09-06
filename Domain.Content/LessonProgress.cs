namespace Domain.Content;

public sealed class LessonProgress
{
    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public Guid LessonId { get; private set; }
    public Guid CourseId { get; private set; }
    public DateTimeOffset CompletedAt { get; private set; }

    private LessonProgress() { }

    public static LessonProgress Create(Guid userId, Guid lessonId, Guid courseId) =>
        new()
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            LessonId = lessonId,
            CourseId = courseId,
            CompletedAt = DateTimeOffset.UtcNow,
        };
}
