using Api.Authorization.Handlers;
using Api.Authorization.Resources;

namespace Api.Authorization.AccessService
{
    public interface IAccessService
    {
        Task<bool> CanViewCourse(Guid userId, CourseShell course, CancellationToken ct);
        Task<bool> CanViewLesson(Guid userId, LessonShell lesson, CancellationToken ct);
    }
}
