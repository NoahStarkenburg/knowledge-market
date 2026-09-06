using AutoMapper;
using Domain.Contracts.Catalog;
using Domain.Catalog;

namespace Application.Catalog;

public sealed class CourseProfile : Profile
{
    public CourseProfile()
    {
        // Value objects and the enum need explicit member mapping; the rest map by name.
        CreateMap<Course, CourseDto>()
            .ForCtorParam(nameof(CourseDto.Title), o => o.MapFrom(s => s.Title.Value))
            .ForCtorParam(nameof(CourseDto.PriceAmount), o => o.MapFrom(s => s.Price.Amount))
            .ForCtorParam(nameof(CourseDto.PriceCurrency), o => o.MapFrom(s => s.Price.Currency))
            .ForCtorParam(nameof(CourseDto.Status), o => o.MapFrom(s => s.Status.ToString()));

        CreateMap<CourseReview, ReviewDto>();
    }
}
