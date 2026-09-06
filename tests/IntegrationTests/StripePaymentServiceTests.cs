using Api.Payments;
using Application.Common;
using Microsoft.Extensions.Configuration;

namespace IntegrationTests;

// Pins the fix for the regression where an empty Stripe:SecretKey made new StripeClient("")
// throw at construction, breaking every endpoint that merely injects IPaymentService (order
// reads, enrollment checks) — not just the payment operations. No server/container needed.
public class StripePaymentServiceTests
{
    private static StripePaymentService Build(string? secretKey)
    {
        var cfg = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Stripe:SecretKey"] = secretKey })
            .Build();
        return new StripePaymentService(cfg);
    }

    [Fact]
    public void Construction_succeeds_with_empty_key()
    {
        var ex = Record.Exception(() => Build(""));
        Assert.Null(ex);
    }

    [Fact]
    public void Construction_succeeds_with_missing_key()
    {
        var ex = Record.Exception(() => Build(null));
        Assert.Null(ex);
    }

    [Fact]
    public async Task Using_a_payment_operation_unconfigured_throws_PaymentException()
    {
        var svc = Build("");
        await Assert.ThrowsAsync<PaymentException>(() => svc.GetPaymentIntentStatusAsync("pi_test", CancellationToken.None));
    }
}
