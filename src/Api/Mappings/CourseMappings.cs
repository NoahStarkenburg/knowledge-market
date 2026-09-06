using Contracts.Catalog;
using Domain.Catalog;
using System.Linq.Expressions;

namespace Api.Mappings
{
    public static class CourseMappings
    {
        // Use this in EF queries (IQueryable.Select)
        public static readonly Expression<Func<Course, CourseDto>> ToDtoProjection =
            c => new CourseDto(
                c.Id,
                c.Title.Value,
                c.Description,
                c.Price.Amount,
                c.Price.Currency,
                c.Status.ToString(),
                c.CreatedAt,
                c.PublishedAt,
                c.CreatedById,
                c.Tags,
                c.ThumbnailFileId,
                c.IntroVideoFileId
            );

        // Use this for in-memory mapping (after you already have a Course instance)
        public static CourseDto ToDto(this Course c) => new(
            c.Id,
            c.Title.Value,
            c.Description,
            c.Price.Amount,
            c.Price.Currency,
            c.Status.ToString(),
            c.CreatedAt,
            c.PublishedAt,
            c.CreatedById,
            c.Tags,
            c.ThumbnailFileId,
            c.IntroVideoFileId
        );
    }
}
