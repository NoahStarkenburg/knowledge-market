using Domain.Contracts.Orders;

namespace Application.Orders;

// Course fields needed to create an order/subscription (read from the Catalog context).
public sealed record CoursePurchaseInfo(string Title, decimal PriceAmount, string PriceCurrency, bool IsPublished, Guid CreatedById);

// Buyer fields needed for Stripe (read from the Identity context).
public sealed record BuyerInfo(string Email, string? StripeCustomerId);

public sealed record CheckoutResult(string? ClientSecret);

// Idempotent=true means an existing subscription was returned (no new Stripe subscription).
public sealed record SubscribeResult(SubscriptionDto Subscription, string? ClientSecret, bool Idempotent);

// Returned by the payment-succeeded webhook handler so the controller can send a receipt email.
public sealed record PaymentReceipt(Guid OrderId, string BuyerEmail, string CourseTitle, decimal Amount, string Currency);
