using AutoMapper;
using Domain.Contracts.Orders;
using Domain.Orders;

namespace Application.Orders;

public sealed class OrderProfile : Profile
{
    public OrderProfile()
    {
        CreateMap<Order, OrderDto>()
            .ForCtorParam(nameof(OrderDto.CourseTitle), o => o.MapFrom(s => s.CourseTitleSnapshot))
            .ForCtorParam(nameof(OrderDto.PriceAmount), o => o.MapFrom(s => s.Price.Amount))
            .ForCtorParam(nameof(OrderDto.PriceCurrency), o => o.MapFrom(s => s.Price.Currency))
            .ForCtorParam(nameof(OrderDto.Status), o => o.MapFrom(s => s.Status.ToString()));

        CreateMap<Subscription, SubscriptionDto>()
            .ForCtorParam(nameof(SubscriptionDto.Status), o => o.MapFrom(s => s.Status.ToString()));
    }
}
