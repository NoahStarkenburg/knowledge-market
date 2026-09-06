using Application.Abstractions;
using Domain.Orders;

namespace IntegrationTests;

// Deterministic stand-in for Stripe so order/checkout/refund/subscription paths are testable
// without network. The client-secret shape keeps "_secret_" so the checkout endpoint can still
// extract a PaymentIntent id from it.
public sealed class FakePaymentService : IPaymentService
{
    public Task<string> GetOrCreateClientSecretAsync(Order order, CancellationToken ct)
        => Task.FromResult($"pi_{Guid.NewGuid():N}_secret_test"); // unique so the PI-id unique index never collides

    public Task<string> GetPaymentIntentStatusAsync(string paymentIntentId, CancellationToken ct)
        => Task.FromResult("requires_payment_method");

    public Task<string> CreateRefundAsync(Order order, CancellationToken ct)
        => Task.FromResult("re_fake");

    public Task<string> GetOrCreateStripeCustomerAsync(Guid userId, string email, string? existingCustomerId, CancellationToken ct)
        => Task.FromResult("cus_fake");

    public Task<(string StripeSubId, string ClientSecret)> CreateStripeSubscriptionAsync(string customerId, string priceId, Guid subscriptionId, CancellationToken ct)
        => Task.FromResult(("sub_fake", "pi_fake_secret_test"));

    public Task CancelStripeSubscriptionAsync(string stripeSubscriptionId, CancellationToken ct)
        => Task.CompletedTask;
}
