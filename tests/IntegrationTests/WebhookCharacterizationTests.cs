using System.Net;
using System.Net.Http.Json;

namespace IntegrationTests;

// Pins the Stripe webhook contract after it moved to WebhooksController (Phase 7): it is
// anonymous, CSRF-exempt, and rejects a payload whose Stripe-Signature can't be verified.
[Collection("api")]
public class WebhookCharacterizationTests
{
    private readonly ApiFactory _factory;

    public WebhookCharacterizationTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Stripe_webhook_rejects_bad_signature_without_auth()
    {
        var client = _factory.CreateClient();

        var req = new HttpRequestMessage(HttpMethod.Post, "/api/webhooks/stripe")
        {
            Content = JsonContent.Create(new { id = "evt_test", type = "payment_intent.succeeded" })
        };
        req.Headers.Add("Stripe-Signature", "t=1,v1=deadbeef");

        var resp = await client.SendAsync(req);

        // Anonymous + CSRF-exempt reached the handler, which fails signature verification.
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }
}
