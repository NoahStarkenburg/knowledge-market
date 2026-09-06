using Microsoft.AspNetCore.Authorization.Infrastructure;

namespace Api.Auth.Handlers
{
    public static class CourseOps
    {
        public static readonly OperationAuthorizationRequirement View = new() { Name = "course.view" };
        public static readonly OperationAuthorizationRequirement Edit = new() { Name = "course.edit" };
        public static readonly OperationAuthorizationRequirement Publish = new() { Name = "course.publish" };
        public static readonly OperationAuthorizationRequirement ManageContent = new() { Name = "course.manageContent" };
        public static readonly OperationAuthorizationRequirement Delete = new() { Name = "course.delete" };
    }

    public static class LessonOps
    {
        public static readonly OperationAuthorizationRequirement View = new() { Name = "lesson.view" };
        public static readonly OperationAuthorizationRequirement Edit = new() { Name = "lesson.edit" };
        public static readonly OperationAuthorizationRequirement UploadAsset = new() { Name = "lesson.uploadAsset" };
        public static readonly OperationAuthorizationRequirement Delete = new() { Name = "lesson.delete" };
    }
}
