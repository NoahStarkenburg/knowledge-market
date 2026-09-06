using System.Linq.Expressions;
using Domain.Contracts.Orders;
using Domain.Orders;

namespace Api.Mappings
{
    public static class OrderMappings
    {
        public static readonly Expression<Func<Order, OrderDto>> ToDtoProjection =
            o => new OrderDto(
                o.Id,
                o.BuyerId,
                o.CourseId,
                o.CourseTitleSnapshot,
                o.Price.Amount,
                o.Price.Currency,
                o.Status.ToString(),
                o.CreatedAt,
                o.PaidAt
            );

        public static OrderDto ToDto(this Order o) =>
            new OrderDto(o.Id, o.BuyerId, o.CourseId, o.CourseTitleSnapshot, o.Price.Amount, o.Price.Currency, o.Status.ToString(), o.CreatedAt, o.PaidAt);
    }
}
