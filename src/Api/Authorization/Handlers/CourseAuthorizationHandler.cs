using Microsoft.AspNetCore.Authorization.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Api.Auth.AccessService;
using Api.Auth.Resources;
using System.Security.Claims;
using Api.Authorization.Claims;

namespace Api.Auth.Handlers
{
    public sealed class CourseAuthorizationHandler(
) : AuthorizationHandler<OperationAuthorizationRequirement, CourseShell>
    {
        protected override Task HandleRequirementAsync(
            AuthorizationHandlerContext context,
            OperationAuthorizationRequirement requirement,
            CourseShell course)
        {
            // 1) Admin bypass (claims-based)
            if (context.User.IsInRole("Admin"))
            {
                context.Succeed(requirement);
                return Task.CompletedTask;
            }

            var userId = context.User.GetUserId();

            if (userId == Guid.Empty) return Task.CompletedTask;
  
            // 2) Owner checks for management operations
            var isOwner = course.ownerId == userId;

            switch (requirement.Name)
            {
                case "course.edit":
                case "course.publish":
                case "course.manageContent":
                case "course.delete":
                    if (isOwner)
                    {
                        context.Succeed(requirement);
                    }
                    break;
                case "course.view":
                    if (course.isPublished || isOwner)
                        context.Succeed(requirement);
                    break;
            }

            return Task.CompletedTask;
        }
    }
}
