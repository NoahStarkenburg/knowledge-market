using Api.Authorization.Handlers;
using Microsoft.AspNetCore.Authorization;

namespace Api.Authorization.Policies
{
    public static class LessonPolicies
    {
        public static void AddLessonPolicies(AuthorizationOptions options)
        {
            options.AddPolicy(PolicyNames.LessonView, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AddRequirements(LessonOps.View);
            });

            options.AddPolicy(PolicyNames.LessonEdit, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AddRequirements(LessonOps.Edit);
            });

            options.AddPolicy(PolicyNames.LessonUploadAsset, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AddRequirements(LessonOps.UploadAsset);
            });

            options.AddPolicy(PolicyNames.LessonDelete, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AddRequirements(LessonOps.Delete);
            });
        }
    }
}
