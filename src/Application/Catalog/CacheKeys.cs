using Domain.Catalog;

namespace Application.Catalog;

// Central cache-key definitions so the producer (CourseService) and every invalidator
// (CourseService writes, UploadService media writes) share one source of truth and never drift.
// Bump the "v1" segment to retire a whole key family at once after the cached shape changes.
public static class CacheKeys
{
    public static string Course(Guid id) => $"course:v1:{id}";
    public const string CatalogStats = "catalog:stats:v1";
    public static string Courses(int page, int pageSize) => $"courses:pub:v1:{page}:{pageSize}";

}