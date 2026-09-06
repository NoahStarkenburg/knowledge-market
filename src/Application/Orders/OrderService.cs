using Application.Abstractions;
using Shared.Kernel;
using AutoMapper;
using Domain.Contracts.Orders;
using Domain.Orders;
using Microsoft.Extensions.Logging;

namespace Application.Orders;

public sealed class OrderService(
    IOrderRepository repo,
    IPaymentService payments,
    IMapper mapper,
    AppMetrics metrics,
    ILogger<OrderService> log) : IOrderService
{
    public async Task<OrderDto> PurchaseAsync(Guid buyerId, PurchaseCourseRequest req, string? idempotencyKey, CancellationToken ct)
    {
        PurchaseValidation.Validate(req, idempotencyKey);
        var key = idempotencyKey!.Trim();

        using var activity = AppDiagnostics.Start("order.purchase");
        activity?.SetTag("course.id", req.CourseId);
        activity?.SetTag("buyer.id", buyerId);

        var existingId = await repo.FindOrderIdByKeyAsync(buyerId, key, ct);
        if (existingId is Guid oid)
        {
            var dto = await repo.GetDtoByIdAsync(oid, ct);
            if (dto is not null)
            {
                activity?.SetTag("order.outcome", "idempotent_replay");
                log.LogInformation("Purchase replayed from idempotency key {OrderId} for course {CourseId}", dto.Id, req.CourseId);
                return dto;
            }
        }

        var existingForCourse = await repo.FindExistingForCourseAsync(buyerId, req.CourseId, ct);
        if (existingForCourse is not null)
        {
            activity?.SetTag("order.outcome", "already_owned");
            return existingForCourse;
        }

        var course = await repo.GetCourseForPurchaseAsync(req.CourseId, ct)
            ?? throw new NotFoundException("Course not found.");
        if (!course.IsPublished)
            throw new BadRequestException("Course must be published to purchase.");

        var order = Order.Create(buyerId, req.CourseId, course.Title, course.PriceAmount, course.PriceCurrency);
        var free = order.Price.Amount == 0;
        if (free) order.MarkPaid();

        var created = await repo.CreateWithIdempotencyAsync(order, key, ct);

        activity?.SetTag("order.id", created.Id);
        activity?.SetTag("order.outcome", free ? "created_free" : "created_pending");
        metrics.RecordOrderCreated(free);
        if (free) metrics.RecordOrderPaid(order.Price.Amount, order.Price.Currency);

        log.LogInformation(
            "Order {OrderId} created for course {CourseId} at {Amount} {Currency} ({Kind})",
            created.Id, req.CourseId, order.Price.Amount, order.Price.Currency, free ? "free" : "paid");

        return created;
    }

    public Task<OrderDto?> GetAsync(Guid id, Guid buyerId, CancellationToken ct) =>
        repo.GetDtoForBuyerAsync(id, buyerId, ct);

    public Task<PagedResult<OrderDto>> ListAsync(Guid buyerId, string? status, string? q, DateTimeOffset? from, DateTimeOffset? to, int page, int pageSize, CancellationToken ct)
    {
        page = page <= 0 ? 1 : page;
        pageSize = pageSize is > 0 and <= 100 ? pageSize : 20;
        return repo.ListAsync(buyerId, status, q, from, to, page, pageSize, ct);
    }

    public Task<bool> IsEnrolledAsync(Guid buyerId, Guid courseId, CancellationToken ct) =>
        repo.IsEnrolledAsync(buyerId, courseId, ct);

    public Task<PagedResult<OrderDto>> AdminListAsync(string? status, string? q, DateTimeOffset? from, DateTimeOffset? to, int page, int pageSize, CancellationToken ct)
    {
        page = page <= 0 ? 1 : page;
        pageSize = pageSize is > 0 and <= 100 ? pageSize : 20;
        return repo.AdminListAsync(status, q, from, to, page, pageSize, ct);
    }

    public async Task<CheckoutResult> CheckoutAsync(Guid buyerId, Guid orderId, CancellationToken ct)
    {
        using var activity = AppDiagnostics.Start("order.checkout");
        activity?.SetTag("order.id", orderId);

        var order = await repo.GetTrackedForBuyerAsync(orderId, buyerId, ct)
            ?? throw new NotFoundException("Order not found.");

        if (order.Price.Amount == 0)
            throw new BadRequestException("Course is free does not need to be checkouted");
        if (order.Status == Orderstatus.Paid)
            throw new BadRequestException("Order is already paid.");

        // Self-heal if the PaymentIntent already succeeded outside the webhook window.
        if (!string.IsNullOrEmpty(order.StripePaymentIntentId))
        {
            var piStatus = await payments.GetPaymentIntentStatusAsync(order.StripePaymentIntentId, ct);
            if (piStatus == "succeeded")
            {
                order.MarkPaid();
                await repo.SaveChangesAsync(ct);

                activity?.SetTag("checkout.outcome", "recovered_succeeded");
                metrics.RecordPayment("checkout", "recovered");
                metrics.RecordOrderPaid(order.Price.Amount, order.Price.Currency);
                log.LogInformation("Order {OrderId} marked paid from an already-succeeded PaymentIntent", order.Id);

                return new CheckoutResult(null);
            }
        }

        var clientSecret = await payments.GetOrCreateClientSecretAsync(order, ct);
        activity?.SetTag("checkout.outcome", "client_secret_issued");
        metrics.RecordPayment("checkout", "client_secret_issued");

        if (string.IsNullOrEmpty(order.StripePaymentIntentId))
        {
            var piId = clientSecret.Split("_secret_")[0];
            order.SetStripePaymentIntent(piId);
            await repo.SaveChangesAsync(ct);
        }

        return new CheckoutResult(clientSecret);
    }

    public async Task<OrderDto> RefundAsync(Guid buyerId, Guid orderId, CancellationToken ct)
    {
        var order = await repo.GetTrackedForBuyerAsync(orderId, buyerId, ct)
            ?? throw new NotFoundException("Order not found.");

        if (order.Status != Orderstatus.Paid)
            throw new BadRequestException("Only paid orders can be refunded.");
        if (order.PaidAt is null || (DateTimeOffset.UtcNow - order.PaidAt.Value).TotalHours > 24)
            throw new BadRequestException("Refunds are only available within 24 hours of payment.");

        try { await payments.CreateRefundAsync(order, ct); }
        catch (InvalidOperationException ex)
        {
            metrics.RecordPayment("refund", "failed");
            log.LogWarning("Refund rejected for order {OrderId}: {Reason}", order.Id, ex.Message);
            throw new BadRequestException(ex.Message);
        }

        order.MarkRefunded();
        await repo.SaveChangesAsync(ct);

        metrics.RecordPayment("refund", "succeeded");
        log.LogInformation("Order {OrderId} refunded at {Amount} {Currency}", order.Id, order.Price.Amount, order.Price.Currency);

        return mapper.Map<OrderDto>(order);
    }

    public async Task<OrderDto> MarkPaidAsync(Guid buyerId, Guid orderId, CancellationToken ct)
    {
        var order = await repo.GetTrackedForBuyerAsync(orderId, buyerId, ct)
            ?? throw new NotFoundException("Order not found.");

        order.MarkPaid();
        await repo.SaveChangesAsync(ct);
        return mapper.Map<OrderDto>(order);
    }

    public async Task<SubscribeResult> SubscribeAsync(Guid buyerId, PurchaseCourseRequest req, string? idempotencyKey, string? priceId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(priceId) || priceId.StartsWith("price_YOUR"))
            throw new BadRequestException("Subscriptions are not configured yet.");

        var key = (idempotencyKey ?? "").Trim();

        var existingSubId = await repo.FindSubscriptionIdByKeyAsync(buyerId, key, ct);
        if (existingSubId is Guid sid)
        {
            var existing = await repo.GetSubscriptionDtoAsync(sid, ct);
            if (existing is not null) return new SubscribeResult(existing, null, Idempotent: true);
        }

        var course = await repo.GetCourseForPurchaseAsync(req.CourseId, ct)
            ?? throw new NotFoundException("Course not found.");
        if (!course.IsPublished)
            throw new BadRequestException("Course must be published to subscribe.");

        var buyer = await repo.GetBuyerAsync(buyerId, ct)
            ?? throw new NotFoundException("Buyer not found.");

        var stripeCustomerId = await payments.GetOrCreateStripeCustomerAsync(buyerId, buyer.Email, buyer.StripeCustomerId, ct);
        if (buyer.StripeCustomerId != stripeCustomerId)
            await repo.SetBuyerStripeCustomerAsync(buyerId, stripeCustomerId, ct);

        var subscription = new Subscription(Guid.NewGuid(), buyerId, course.CreatedById);

        var (created, subId) = await repo.TryCreateSubscriptionAsync(subscription, key, ct);
        if (!created)
        {
            var existing = await repo.GetSubscriptionDtoAsync(subId, ct);
            return new SubscribeResult(existing!, null, Idempotent: true);
        }

        // Create the Stripe subscription after the local commit so the id is stable.
        string stripeSubId, clientSecret;
        try
        {
            (stripeSubId, clientSecret) = await payments.CreateStripeSubscriptionAsync(stripeCustomerId, priceId, subscription.Id, ct);
        }
        catch (PaymentException)
        {
            await repo.DeleteSubscriptionAsync(subscription.Id, ct);
            throw;
        }

        await repo.SetSubscriptionStripeIdAsync(subscription.Id, stripeSubId, ct);

        return new SubscribeResult(mapper.Map<SubscriptionDto>(subscription), clientSecret, Idempotent: false);
    }

    public Task<IReadOnlyList<SubscriptionDto>> ListSubscriptionsAsync(Guid buyerId, CancellationToken ct) =>
        repo.ListSubscriptionsAsync(buyerId, ct);

    public async Task CancelSubscriptionAsync(Guid buyerId, Guid subscriptionId, CancellationToken ct)
    {
        var sub = await repo.GetTrackedSubscriptionForBuyerAsync(subscriptionId, buyerId, ct)
            ?? throw new NotFoundException("Subscription not found.");

        if (!string.IsNullOrEmpty(sub.StripeSubscriptionId))
            await payments.CancelStripeSubscriptionAsync(sub.StripeSubscriptionId, ct);

        sub.Cancel();
        await repo.SaveChangesAsync(ct);
    }

    public async Task<PaymentReceipt?> ProcessPaymentSucceededAsync(string paymentIntentId, DateTimeOffset paidAt, CancellationToken ct)
    {
        using var activity = AppDiagnostics.Start("payment.succeeded");
        activity?.SetTag("stripe.payment_intent_id", paymentIntentId);

        var order = await repo.GetTrackedOrderByPaymentIntentAsync(paymentIntentId, ct);
        if (order is null)
        {
            activity?.SetTag("payment.outcome", "order_not_found");
            log.LogWarning("Payment succeeded webhook had no matching order for PaymentIntent {PaymentIntentId}", paymentIntentId);
            metrics.RecordPayment("webhook", "orphaned");
            return null;
        }
        if (order.Status == Orderstatus.Paid)
        {
            // Stripe retries webhooks; a second delivery landing here is expected, not an error.
            activity?.SetTag("payment.outcome", "duplicate_webhook");
            metrics.RecordPayment("webhook", "duplicate");
            return null;
        }

        order.MarkPaid(paidAt);
        await repo.SaveChangesAsync(ct);

        activity?.SetTag("order.id", order.Id);
        activity?.SetTag("payment.outcome", "paid");
        metrics.RecordPayment("webhook", "succeeded");
        metrics.RecordOrderPaid(order.Price.Amount, order.Price.Currency);
        log.LogInformation(
            "Order {OrderId} paid via webhook at {Amount} {Currency}",
            order.Id, order.Price.Amount, order.Price.Currency);

        var buyerEmail = await repo.GetBuyerEmailAsync(order.BuyerId, ct);
        if (buyerEmail is null) return null;

        return new PaymentReceipt(order.Id, buyerEmail, order.CourseTitleSnapshot, order.Price.Amount, order.Price.Currency);
    }

    public async Task ApplyStripeSubscriptionUpdateAsync(string stripeSubscriptionId, string status, DateTimeOffset periodStart, DateTimeOffset periodEnd, CancellationToken ct)
    {
        var sub = await repo.GetTrackedSubscriptionByStripeIdAsync(stripeSubscriptionId, ct);
        if (sub is null) return;

        switch (status)
        {
            case "active":
                sub.MarkActive();
                sub.UpdatePeriod(periodStart, periodEnd);
                break;
            case "past_due":
                sub.MarkPastDue();
                break;
            case "canceled":
            case "unpaid":
                sub.Cancel();
                break;
            case "incomplete_expired":
                sub.MarkInactive();
                break;
        }

        await repo.SaveChangesAsync(ct);
    }

    public async Task CancelSubscriptionByStripeIdAsync(string stripeSubscriptionId, CancellationToken ct)
    {
        var sub = await repo.GetTrackedSubscriptionByStripeIdAsync(stripeSubscriptionId, ct);
        if (sub is null) return;
        sub.Cancel();
        await repo.SaveChangesAsync(ct);
    }

    public async Task MarkSubscriptionPastDueByStripeIdAsync(string stripeSubscriptionId, CancellationToken ct)
    {
        var sub = await repo.GetTrackedSubscriptionByStripeIdAsync(stripeSubscriptionId, ct);
        if (sub is null) return;
        sub.MarkPastDue();
        await repo.SaveChangesAsync(ct);
    }
}
