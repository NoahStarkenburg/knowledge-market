using System.Data.SqlTypes;
using System.Security.Cryptography.X509Certificates;
using Domain.Primatives;

namespace Domain.Orders;

public sealed class Order
{
    public Guid Id { get; private set; }
    public Guid BuyerId { get; private set; }
    public Guid CourseId { get; private set; }
    public string CourseTitleSnapshot { get; private set; } = null!;
    public Money Price { get; private set; }
    public Orderstatus Status { get; private set; } = Orderstatus.Pending;
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? PaidAt { get; private set; }
    public string? StripePaymentIntentId { get; private set; }

    public static Order Create(Guid buyerId, Guid courseId, string courseTitle, decimal priceAmmount, string priceCurrency)
    {
        if (buyerId == Guid.Empty) throw new ArgumentException("Buyer is required", nameof(buyerId));
        if (courseId == Guid.Empty) throw new ArgumentException("Course is required", nameof(courseId));
        if (string.IsNullOrWhiteSpace(courseTitle) || courseTitle.Length is < 3 or > 200)
            throw new ArgumentException("Course title is required and should be at most 200 characters long.", nameof(courseTitle));

        return new Order
        {
            Id = Guid.NewGuid(),
            BuyerId = buyerId,
            CourseId = courseId,
            CourseTitleSnapshot = courseTitle.Trim(),
            Price = Money.Create(priceAmmount, priceCurrency),
            Status = Orderstatus.Pending,
            CreatedAt = DateTimeOffset.UtcNow
        };
    }

    public void MarkPaid(DateTimeOffset? paidAt = null)
    {
        if (Status == Orderstatus.Paid) return;
        Status = Orderstatus.Paid;
        PaidAt = paidAt ?? DateTimeOffset.UtcNow;
    }

    public void SetStripePaymentIntent(string paymentIntentId)
    {
        if (string.IsNullOrWhiteSpace(paymentIntentId))
            throw new ArgumentException("Payment intent ID is required.", nameof(paymentIntentId));
        StripePaymentIntentId = paymentIntentId;
    }

    public void MarkRefunded()
    {
        if (Status == Orderstatus.Refunded) return;
        Status = Orderstatus.Refunded;
    }
}
