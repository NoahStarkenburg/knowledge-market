using Api.Auth.Handlers;
using Api.Auth.Resources;

namespace Api.Auth.AccessService
{
    public interface IAccessService
    {
        Task<bool> CanViewCourse(Guid userId, CourseShell course, CancellationToken ct);
        Task<bool> CanViewLesson(Guid userId, LessonShell lesson, CancellationToken ct);
    }
}
