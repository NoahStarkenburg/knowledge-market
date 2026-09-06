using System.Diagnostics.Metrics;

namespace Shared.Kernel;

// Business metrics, on top of the automatic HTTP/runtime ones. They live on the
// "KnowledgeMarket" meter, which the API registers with OpenTelemetry so they export
// to Mimir alongside everything else. Kept in Application because the services that
// record them live here — the API only owns the wiring.
public sealed class AppMetrics
{
    public const string MeterName = "KnowledgeMarket";

    private readonly Counter<long> _registrations;
    private readonly Counter<long> _logins;
    private readonly Counter<long> _ordersCreated;
    private readonly Counter<long> _ordersPaid;
    private readonly Histogram<double> _orderValue;
    private readonly Counter<long> _payments;
    private readonly Counter<long> _cacheRequests;
    private readonly Counter<long> _coursesPublished;
    private readonly Counter<long> _cartItemsAdded;
    private readonly Counter<long> _cartCheckouts;
    private readonly Histogram<int> _cartCheckoutItems;

    public AppMetrics(IMeterFactory meterFactory)
    {
        var meter = meterFactory.Create(MeterName);

        _registrations = meter.CreateCounter<long>(
            "km.users.registered", unit: "{user}", description: "New user registrations");
        _logins = meter.CreateCounter<long>(
            "km.logins", unit: "{login}", description: "Login attempts, tagged by outcome");
        _ordersCreated = meter.CreateCounter<long>(
            "km.orders.created", unit: "{order}", description: "Orders created, tagged free or paid");
        _ordersPaid = meter.CreateCounter<long>(
            "km.orders.paid", unit: "{order}", description: "Orders that reached the paid state");
        _orderValue = meter.CreateHistogram<double>(
            "km.order.value", unit: "USD", description: "Value of orders that reached the paid state");
        _payments = meter.CreateCounter<long>(
            "km.payments", unit: "{payment}", description: "Payment provider operations, tagged by operation and outcome");
        _cacheRequests = meter.CreateCounter<long>(
            "km.cache.requests", unit: "{request}", description: "Cache reads, tagged hit, miss, or error");
        _coursesPublished = meter.CreateCounter<long>(
            "km.courses.published", unit: "{course}", description: "Courses moved from draft to published");

        _cartItemsAdded = meter.CreateCounter<long>(
            "km.cart.items.added", unit: "{item}", description: "Courses added to a cart");
        _cartCheckouts = meter.CreateCounter<long>(
            "km.cart.checkouts", unit: "{checkout}", description: "Cart checkouts completed");
        _cartCheckoutItems = meter.CreateHistogram<int>(
            "km.cart.checkout.items", unit: "{course}", description: "Courses per cart checkout");
    }

    public void RecordRegistration() => _registrations.Add(1);

    public void RecordLogin(bool success) =>
        _logins.Add(1, new KeyValuePair<string, object?>("outcome", success ? "success" : "failure"));

    public void RecordOrderCreated(bool free) =>
        _ordersCreated.Add(1, new KeyValuePair<string, object?>("kind", free ? "free" : "paid"));

    public void RecordOrderPaid(decimal amount, string currency)
    {
        var tag = new KeyValuePair<string, object?>("currency", currency);
        _ordersPaid.Add(1, tag);
        _orderValue.Record((double)amount, tag);
    }

    public void RecordPayment(string operation, string outcome) =>
        _payments.Add(1,
            new KeyValuePair<string, object?>("operation", operation),
            new KeyValuePair<string, object?>("outcome", outcome));

    // region groups keys by prefix (course, catalog) so one hot key can't hide a cold one.
    public void RecordCacheRequest(string region, string result) =>
        _cacheRequests.Add(1,
            new KeyValuePair<string, object?>("region", region),
            new KeyValuePair<string, object?>("result", result));

    public void RecordCoursePublished() => _coursesPublished.Add(1);

    public void RecordCartItemAdded() => _cartItemsAdded.Add(1);

    public void RecordCartCheckout(int itemCount)
    {
        _cartCheckouts.Add(1);
        _cartCheckoutItems.Record(itemCount);
    }
}
