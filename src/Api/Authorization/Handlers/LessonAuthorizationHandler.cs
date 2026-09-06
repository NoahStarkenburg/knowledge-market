using Microsoft.AspNetCore.Authorization.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Api.Auth.AccessService;
using Api.Auth.Resources;

namespace Api.Auth.Handlers
{
    public sealed class LessonAuthorizationHandler(
    ICurrentUser currentUser,
    IAccessService access
) : AuthorizationHandler<OperationAuthorizationRequirement, LessonShell>
    {
        protected override async Task HandleRequirementAsync(
            AuthorizationHandlerContext context,
            OperationAuthorizationRequirement requirement,
            LessonShell lesson)
        {
            if (context.User.IsInRole("Admin"))
            {
                context.Succeed(requirement);
                return;
            }

            var userId = await currentUser.GetRequiredUserIdAsync();
            if (userId == Guid.Empty) return;

            var isOwner = lesson.ownerId == userId;

            if (requirement.Name is "lesson.edit" or "lesson.uploadAsset" or "lesson.delete")
            {
                if (isOwner) context.Succeed(requirement);
                return;
            }

            if (requirement.Name == "lesson.view")
            {
                if (await access.CanViewLesson(userId, lesson, CancellationToken.None))
                    context.Succeed(requirement);
            }
        }
    }
}
