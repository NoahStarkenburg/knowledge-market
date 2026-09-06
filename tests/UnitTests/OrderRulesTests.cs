using Domain.Orders;

namespace UnitTests;

// Pins the Order state transitions that will move out of the entity and into
// OrderService during the layered refactor.
public class OrderRulesTests
{
    private static Order NewOrder() =>
        Order.Create(Guid.NewGuid(), Guid.NewGuid(), "Some Course", 25m, "USD");

    [Fact]
    public void Create_valid_order_is_pending()
    {
        var order = NewOrder();

        Assert.Equal(Orderstatus.Pending, order.Status);
        Assert.Null(order.PaidAt);
        Assert.Equal(25m, order.Price.Amount);
    }

    [Fact]
    public void Create_requires_buyer()
        => Assert.Throws<ArgumentException>(() =>
            Order.Create(Guid.Empty, Guid.NewGuid(), "Some Course", 25m, "USD"));

    [Fact]
    public void Create_requires_course()
        => Assert.Throws<ArgumentException>(() =>
            Order.Create(Guid.NewGuid(), Guid.Empty, "Some Course", 25m, "USD"));

    [Fact]
    public void Create_requires_reasonable_title()
        => Assert.Throws<ArgumentException>(() =>
            Order.Create(Guid.NewGuid(), Guid.NewGuid(), "ab", 25m, "USD"));

    [Fact]
    public void MarkPaid_sets_status_and_timestamp()
    {
        var order = NewOrder();
        var when = DateTimeOffset.UtcNow;

        order.MarkPaid(when);

        Assert.Equal(Orderstatus.Paid, order.Status);
        Assert.Equal(when, order.PaidAt);
    }

    [Fact]
    public void MarkPaid_is_idempotent_and_keeps_first_paid_time()
    {
        var order = NewOrder();
        var first = DateTimeOffset.UtcNow.AddMinutes(-10);

        order.MarkPaid(first);
        order.MarkPaid(DateTimeOffset.UtcNow);

        Assert.Equal(Orderstatus.Paid, order.Status);
        Assert.Equal(first, order.PaidAt);
    }

    [Fact]
    public void MarkRefunded_sets_status()
    {
        var order = NewOrder();
        order.MarkPaid();

        order.MarkRefunded();

        Assert.Equal(Orderstatus.Refunded, order.Status);
    }

    [Fact]
    public void SetStripePaymentIntent_requires_a_value()
    {
        var order = NewOrder();

        Assert.Throws<ArgumentException>(() => order.SetStripePaymentIntent(" "));
    }
}
