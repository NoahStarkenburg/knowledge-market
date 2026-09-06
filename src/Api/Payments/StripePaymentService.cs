using Serilog;
using Stripe;
using Domain.Orders;
using Application.Abstractions;
using Application.Common;

namespace Api.Payments;

public sealed class StripePaymentService : IPaymentService
{
    private readonly PaymentIntentService? _intents;
    private readonly RefundService? _refunds;
    private readonly CustomerService? _customers;
    private readonly SubscriptionService? _subscriptions;

    // Constructing with an empty key would make new StripeClient("") throw, which would break
    // every endpoint that merely injects this service (order reads, enrollment checks) rather
    // than only the payment operations. So we stay unconfigured until a real key is present and
    // fail cleanly (PaymentException) only when a payment is actually attempted.
    public StripePaymentService(IConfiguration cfg)
    {
        var key = cfg["Stripe:SecretKey"];
        if (!string.IsNullOrWhiteSpace(key))
        {
            var client = new StripeClient(key);
            _intents = new PaymentIntentService(client);
            _refunds = new RefundService(client);
            _customers = new CustomerService(client);
            _subscriptions = new SubscriptionService(client);
        }
    }

    private PaymentIntentService Intents => _intents ?? throw NotConfigured();
    private RefundService Refunds => _refunds ?? throw NotConfigured();
    private CustomerService Customers => _customers ?? throw NotConfigured();
    private SubscriptionService Subscriptions => _subscriptions ?? throw NotConfigured();
    private static PaymentException NotConfigured() => new("Stripe is not configured.");

    public async Task<string> GetOrCreateClientSecretAsync(Order order, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(order.StripePaymentIntentId))
        {
            var existing = await Intents.GetAsync(
                order.StripePaymentIntentId,
                cancellationToken: ct);
            return existing.ClientSecret;
        }

        var amountCents = (long)Math.Round(order.Price.Amount * 100, MidpointRounding.AwayFromZero);

        var options = new PaymentIntentCreateOptions
        {
            Amount = amountCents,
            Currency = order.Price.Currency,
            AutomaticPaymentMethods = new PaymentIntentAutomaticPaymentMethodsOptions
            {
                Enabled = true,
                AllowRedirects = "never",
            },
            Metadata = new Dictionary<string, string>
            {
                ["order_id"]  = order.Id.ToString(),
                ["buyer_id"]  = order.BuyerId.ToString(),
                ["course_id"] = order.CourseId.ToString(),
            },
        };

        var intent = await Intents.CreateAsync(options, cancellationToken: ct);
        Log.Information("PaymentIntent created {PaymentIntentId} for order {OrderId}", intent.Id, order.Id);
        return intent.ClientSecret;
    }

    public async Task<string> GetPaymentIntentStatusAsync(string paymentIntentId, CancellationToken ct)
    {
        var pi = await Intents.GetAsync(paymentIntentId, cancellationToken: ct);
        return pi.Status;
    }

    public async Task<string> CreateRefundAsync(Order order, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(order.StripePaymentIntentId))
            throw new InvalidOperationException("Order has no associated Stripe payment to refund.");

        var refund = await Refunds.CreateAsync(new RefundCreateOptions
        {
            PaymentIntent = order.StripePaymentIntentId,
        }, cancellationToken: ct);

        Log.Information("Refund created {RefundId} for order {OrderId}", refund.Id, order.Id);
        return refund.Id;
    }

    public async Task<string> GetOrCreateStripeCustomerAsync(
        Guid userId, string email, string? existingCustomerId, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(existingCustomerId))
        {
            // Verify it still exists in Stripe
            try
            {
                var existing = await Customers.GetAsync(existingCustomerId, cancellationToken: ct);
                if (!existing.Deleted.GetValueOrDefault())
                    return existing.Id;
            }
            catch (StripeException) { /* fall through and create a new one */ }
        }

        try
        {
            var customer = await Customers.CreateAsync(new CustomerCreateOptions
            {
                Email = email,
                Metadata = new Dictionary<string, string>
                {
                    ["km_user_id"] = userId.ToString()
                }
            }, cancellationToken: ct);

            return customer.Id;
        }
        catch (StripeException ex)
        {
            throw new PaymentException(ex.Message);
        }
    }

    public async Task<(string StripeSubId, string ClientSecret)> CreateStripeSubscriptionAsync(
        string customerId, string priceId, Guid subscriptionId, CancellationToken ct)
    {
        var options = new SubscriptionCreateOptions
        {
            Customer = customerId,
            Items = new List<SubscriptionItemOptions>
            {
                new() { Price = priceId }
            },
            PaymentBehavior = "default_incomplete",
            PaymentSettings = new SubscriptionPaymentSettingsOptions
            {
                SaveDefaultPaymentMethod = "on_subscription",
                PaymentMethodTypes = new List<string> { "card" },
            },
            Expand = new List<string> { "latest_invoice.payment_intent" },
            Metadata = new Dictionary<string, string>
            {
                ["km_subscription_id"] = subscriptionId.ToString()
            }
        };

        try
        {
            var sub = await Subscriptions.CreateAsync(options, cancellationToken: ct);
            Log.Information("Stripe subscription created {StripeSubId} for customer {CustomerId}", sub.Id, customerId);
            var clientSecret = sub.LatestInvoice.PaymentIntent.ClientSecret;
            return (sub.Id, clientSecret);
        }
        catch (StripeException ex)
        {
            throw new PaymentException(ex.Message);
        }
    }

    public async Task CancelStripeSubscriptionAsync(string stripeSubscriptionId, CancellationToken ct)
    {
        try
        {
            await Subscriptions.CancelAsync(stripeSubscriptionId, new SubscriptionCancelOptions(), cancellationToken: ct);
            Log.Information("Stripe subscription canceled {StripeSubId}", stripeSubscriptionId);
        }
        catch (StripeException ex) when (ex.StripeError?.Code == "resource_missing")
        {
            // Already canceled/absent in Stripe — proceed with the local cancel.
        }
    }
}
