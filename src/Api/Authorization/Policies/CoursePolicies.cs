using Api.Auth.Handlers;
using Microsoft.AspNetCore.Authorization;

namespace Api.Authorization.Policies
{
    public class CoursePolicies
    {
        public static void AddCoursePolicies(AuthorizationOptions options)
        {
            options.AddPolicy(PolicyNames.CourseView, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AddRequirements(CourseOps.View);
            });

            options.AddPolicy(PolicyNames.CourseEdit, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AddRequirements(CourseOps.Edit);
            });

            options.AddPolicy(PolicyNames.CoursePublish, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AddRequirements(CourseOps.Publish);
            });

            options.AddPolicy(PolicyNames.CourseManageContent, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AddRequirements(CourseOps.ManageContent);
            });

            options.AddPolicy(PolicyNames.CourseDelete, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AddRequirements(CourseOps.Delete);
            });
        }
    }
}
