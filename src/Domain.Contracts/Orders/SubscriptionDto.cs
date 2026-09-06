namespace Domain.Contracts.Orders
{
    public sealed record SubscriptionDto(
        Guid Id,
        Guid BuyerId,
        Guid CoursesOwnerId,
        string Status,
        DateTimeOffset CurrentPeriodStart,
        DateTimeOffset CurrentPeriodEnd
    );
}
