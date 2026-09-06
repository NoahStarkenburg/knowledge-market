using Shared.Kernel;
using Application.Orders;
using Domain.Contracts.Orders;
using Domain.Orders;

namespace Application.Abstractions;

public interface IOrderRepository
{
    // Orders
    Task<Guid?> FindOrderIdByKeyAsync(Guid buyerId, string key, CancellationToken ct);
    Task<OrderDto?> GetDtoByIdAsync(Guid id, CancellationToken ct);
    Task<OrderDto?> GetDtoForBuyerAsync(Guid id, Guid buyerId, CancellationToken ct);
    Task<OrderDto?> FindExistingForCourseAsync(Guid buyerId, Guid courseId, CancellationToken ct);
    Task<Order?> GetTrackedForBuyerAsync(Guid id, Guid buyerId, CancellationToken ct);
    Task<CoursePurchaseInfo?> GetCourseForPurchaseAsync(Guid courseId, CancellationToken ct);
    Task<OrderDto> CreateWithIdempotencyAsync(Order order, string key, CancellationToken ct);
    Task<PagedResult<OrderDto>> ListAsync(Guid buyerId, string? status, string? q, DateTimeOffset? from, DateTimeOffset? to, int page, int pageSize, CancellationToken ct);
    Task<bool> IsEnrolledAsync(Guid buyerId, Guid courseId, CancellationToken ct);
    Task<PagedResult<OrderDto>> AdminListAsync(string? status, string? q, DateTimeOffset? from, DateTimeOffset? to, int page, int pageSize, CancellationToken ct);
    Task SaveChangesAsync(CancellationToken ct);

    // Subscriptions
    Task<Guid?> FindSubscriptionIdByKeyAsync(Guid buyerId, string key, CancellationToken ct);
    Task<SubscriptionDto?> GetSubscriptionDtoAsync(Guid id, CancellationToken ct);
    Task<BuyerInfo?> GetBuyerAsync(Guid buyerId, CancellationToken ct);
    Task SetBuyerStripeCustomerAsync(Guid buyerId, string customerId, CancellationToken ct);
    Task<(bool Created, Guid SubId)> TryCreateSubscriptionAsync(Subscription subscription, string key, CancellationToken ct);
    Task SetSubscriptionStripeIdAsync(Guid subscriptionId, string stripeSubId, CancellationToken ct);
    Task DeleteSubscriptionAsync(Guid subscriptionId, CancellationToken ct);
    Task<IReadOnlyList<SubscriptionDto>> ListSubscriptionsAsync(Guid buyerId, CancellationToken ct);
    Task<Subscription?> GetTrackedSubscriptionForBuyerAsync(Guid id, Guid buyerId, CancellationToken ct);

    // Webhook lookups (by Stripe identifiers)
    Task<Order?> GetTrackedOrderByPaymentIntentAsync(string paymentIntentId, CancellationToken ct);
    Task<string?> GetBuyerEmailAsync(Guid buyerId, CancellationToken ct);
    Task<Subscription?> GetTrackedSubscriptionByStripeIdAsync(string stripeSubscriptionId, CancellationToken ct);
}
