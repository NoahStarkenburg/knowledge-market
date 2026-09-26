using Application.Abstractions;
using Azure;
using Azure.Communication.Email;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Email;

// Sends through Azure Communication Services Email. The EmailClient signs in with the API's managed
// identity, so there is no SMTP password or access key anywhere.
//
// Callers fire and forget (`_ = email.SendAsync(...)`) from inside a request, so this never throws:
// a failure is logged instead, and the request that triggered the email is unaffected. It also ignores
// the caller's token, which belongs to a request that has usually finished by the time the send runs.
// Making delivery durable (an outbox with retries) is a separate step.
public sealed class AcsEmailService(EmailClient client, IConfiguration cfg, ILogger<AcsEmailService> log) : IEmailService
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    public async Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
    {
        var from = cfg["Email:From"]!;
        using var timeout = new CancellationTokenSource(Timeout);
        try
        {
            // WaitUntil.Started returns once Azure has accepted the message; delivery continues on its side.
            var operation = await client.SendAsync(WaitUntil.Started, from, to, subject, htmlBody, cancellationToken: timeout.Token);
            log.LogInformation("Email accepted for delivery: {Subject} ({OperationId})", subject, operation.Id);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Email could not be sent: {Subject}", subject);
        }
    }
}
