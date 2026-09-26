using Azure;
using Azure.Communication.Email;
using Infrastructure.Email;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace IntegrationTests;

// No Azure involved: a fake EmailClient records what would have been sent. Sending for real needs a
// managed identity and a Communication Services resource, so that part is verified after deploy.
public class AcsEmailServiceTests
{
    private sealed class FakeEmailClient(Exception? fail = null) : EmailClient
    {
        public List<(string From, string To, string Subject, string Html)> Sent { get; } = [];

        public override Task<EmailSendOperation> SendAsync(WaitUntil wait, string senderAddress, string recipientAddress,
            string subject, string htmlContent, string? plainTextContent = null, CancellationToken cancellationToken = default)
        {
            if (fail is not null) throw fail;
            Sent.Add((senderAddress, recipientAddress, subject, htmlContent));
            return Task.FromResult(new EmailSendOperation("operation-1", this));
        }
    }

    private static IConfiguration Config() => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Email:From"] = "DoNotReply@example.azurecomm.net" })
        .Build();

    [Fact]
    public async Task Sends_from_the_configured_address()
    {
        var client = new FakeEmailClient();
        var service = new AcsEmailService(client, Config(), NullLogger<AcsEmailService>.Instance);

        await service.SendAsync("student@example.com", "Verify your email", "<p>hi</p>");

        var sent = Assert.Single(client.Sent);
        Assert.Equal("DoNotReply@example.azurecomm.net", sent.From);
        Assert.Equal("student@example.com", sent.To);
        Assert.Equal("Verify your email", sent.Subject);
    }

    // Callers fire and forget from inside a request, so a failed send must be logged, not thrown.
    [Fact]
    public async Task A_failed_send_does_not_throw()
    {
        var client = new FakeEmailClient(new RequestFailedException(403, "not authorized"));
        var service = new AcsEmailService(client, Config(), NullLogger<AcsEmailService>.Instance);

        var error = await Record.ExceptionAsync(() => service.SendAsync("student@example.com", "Verify your email", "<p>hi</p>"));

        Assert.Null(error);
    }
}
