using Infrastructure.Email;
using Application.Abstractions;
using Application.Orders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;
using Stripe;

namespace Api.Controllers;

// Stripe sends a raw-body POST with a Stripe-Signature header. Anonymous (no JWT) and
// CSRF-exempt (excluded by path in the CSRF middleware). Signature verification and event
// extraction are adapter concerns and stay here; the DB writes go through IOrderService.
[ApiController]
[Route("api/webhooks")]
[ApiExplorerSettings(IgnoreApi = true)]
public sealed class WebhooksController(
    IOrderService orders,
    IConfiguration cfg,
    IEmailService email) : ControllerBase
{
    [HttpPost("stripe")]
    [AllowAnonymous]
    public async Task<IActionResult> Stripe(CancellationToken ct)
    {
        var webhookSecret = cfg["Stripe:WebhookSecret"];
        if (string.IsNullOrEmpty(webhookSecret))
            return Problem("Stripe webhook secret not configured.", statusCode: 500);

        // Read raw body — Stripe signature verification requires the exact bytes.
        string json;
        using (var reader = new StreamReader(Request.Body))
            json = await reader.ReadToEndAsync(ct);

        Event stripeEvent;
        try
        {
            var sig = Request.Headers["Stripe-Signature"].ToString();
            stripeEvent = EventUtility.ConstructEvent(json, sig, webhookSecret, throwOnApiVersionMismatch: false);
        }
        catch (StripeException ex)
        {
            return BadRequest(new { error = "Webhook signature invalid.", detail = ex.Message });
        }

        Log.Information("Stripe webhook received: {EventType} {EventId}", stripeEvent.Type, stripeEvent.Id);

        switch (stripeEvent.Type)
        {
            case EventTypes.PaymentIntentSucceeded:
                if (stripeEvent.Data.Object is PaymentIntent intent)
                {
                    var receipt = await orders.ProcessPaymentSucceededAsync(intent.Id, intent.Created, ct);
                    if (receipt is not null)
                    {
                        Log.Information("Order {OrderId} marked paid via webhook (PI {PaymentIntentId})", receipt.OrderId, intent.Id);
                        _ = email.SendAsync(receipt.BuyerEmail, $"Purchase confirmed: {receipt.CourseTitle}",
                            EmailTemplates.PurchaseReceipt(receipt.CourseTitle, receipt.Amount, receipt.Currency), ct);
                    }
                }
                break;

            case EventTypes.PaymentIntentPaymentFailed:
                // Log only for now — order stays Pending so user can retry.
                break;

            case EventTypes.CustomerSubscriptionUpdated:
                if (stripeEvent.Data.Object is Subscription stripeSub)
                    await orders.ApplyStripeSubscriptionUpdateAsync(
                        stripeSub.Id, stripeSub.Status,
                        new DateTimeOffset(stripeSub.CurrentPeriodStart, TimeSpan.Zero),
                        new DateTimeOffset(stripeSub.CurrentPeriodEnd, TimeSpan.Zero), ct);
                break;

            case EventTypes.CustomerSubscriptionDeleted:
                if (stripeEvent.Data.Object is Subscription deletedSub)
                    await orders.CancelSubscriptionByStripeIdAsync(deletedSub.Id, ct);
                break;

            case EventTypes.InvoicePaymentFailed:
                if (stripeEvent.Data.Object is Invoice invoice && invoice.SubscriptionId is not null)
                    await orders.MarkSubscriptionPastDueByStripeIdAsync(invoice.SubscriptionId, ct);
                break;
        }

        return Ok();
    }
}
