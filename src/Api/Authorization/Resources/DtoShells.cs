namespace Api.Authorization.Resources
{
    public sealed record CourseShell(Guid courseId, Guid ownerId, bool isPublished);
    public sealed record LessonShell(Guid lessonId, Guid courseId, Guid ownerId, bool isFreePreview);
}
