using Microsoft.EntityFrameworkCore.SqlServer.Query.Internal;

namespace Api.Authorization.Policies
{
    public static class PolicyNames
    {
        // Course
        public const string CourseView = "course:view";
        public const string CourseEdit = "course:edit";
        public const string CoursePublish = "course:publish";
        public const string CourseManageContent = "course:manageContent";
        public const string CourseDelete = "course:delete";

        // Lesson
        public const string LessonView = "lesson:view";
        public const string LessonEdit = "lesson:edit";
        public const string LessonUploadAsset = "lesson:uploadAsset";
        public const string LessonDelete = "lesson:delete";
    }
}
