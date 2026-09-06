using Application.Common;
using Domain.Contracts.Orders;

namespace Application.Orders;

public interface IOrderService
{
    Task<OrderDto> PurchaseAsync(Guid buyerId, PurchaseCourseRequest req, string? idempotencyKey, CancellationToken ct);
    Task<OrderDto?> GetAsync(Guid id, Guid buyerId, CancellationToken ct);
    Task<PagedResult<OrderDto>> ListAsync(Guid buyerId, string? status, string? q, DateTimeOffset? from, DateTimeOffset? to, int page, int pageSize, CancellationToken ct);
    Task<bool> IsEnrolledAsync(Guid buyerId, Guid courseId, CancellationToken ct);
    Task<PagedResult<OrderDto>> AdminListAsync(string? status, string? q, DateTimeOffset? from, DateTimeOffset? to, int page, int pageSize, CancellationToken ct);
    Task<CheckoutResult> CheckoutAsync(Guid buyerId, Guid orderId, CancellationToken ct);
    Task<OrderDto> RefundAsync(Guid buyerId, Guid orderId, CancellationToken ct);
    Task<OrderDto> MarkPaidAsync(Guid buyerId, Guid orderId, CancellationToken ct);
    Task<SubscribeResult> SubscribeAsync(Guid buyerId, PurchaseCourseRequest req, string? idempotencyKey, string? priceId, CancellationToken ct);
    Task<IReadOnlyList<SubscriptionDto>> ListSubscriptionsAsync(Guid buyerId, CancellationToken ct);
    Task CancelSubscriptionAsync(Guid buyerId, Guid subscriptionId, CancellationToken ct);

    // Stripe webhook side effects (called from the webhook controller with primitive data).
    Task<PaymentReceipt?> ProcessPaymentSucceededAsync(string paymentIntentId, DateTimeOffset paidAt, CancellationToken ct);
    Task ApplyStripeSubscriptionUpdateAsync(string stripeSubscriptionId, string status, DateTimeOffset periodStart, DateTimeOffset periodEnd, CancellationToken ct);
    Task CancelSubscriptionByStripeIdAsync(string stripeSubscriptionId, CancellationToken ct);
    Task MarkSubscriptionPastDueByStripeIdAsync(string stripeSubscriptionId, CancellationToken ct);
}
