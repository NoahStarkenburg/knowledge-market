using Domain.Orders;

namespace Application.Abstractions;

// Payment gateway abstraction. Implemented by the Stripe adapter in the web layer.
public interface IPaymentService
{
    Task<string> GetOrCreateClientSecretAsync(Order order, CancellationToken ct);
    Task<string> GetPaymentIntentStatusAsync(string paymentIntentId, CancellationToken ct);
    Task<string> CreateRefundAsync(Order order, CancellationToken ct);

    Task<string> GetOrCreateStripeCustomerAsync(Guid userId, string email, string? existingCustomerId, CancellationToken ct);
    Task<(string StripeSubId, string ClientSecret)> CreateStripeSubscriptionAsync(string customerId, string priceId, Guid subscriptionId, CancellationToken ct);
    Task CancelStripeSubscriptionAsync(string stripeSubscriptionId, CancellationToken ct);
}
