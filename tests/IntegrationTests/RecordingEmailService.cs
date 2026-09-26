using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Application.Abstractions;

namespace IntegrationTests;

// Keeps every email the API sends so a test can follow the link inside it.
public sealed partial class RecordingEmailService : IEmailService
{
    private readonly ConcurrentQueue<(string To, string Html)> _sent = new();

    public Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
    {
        _sent.Enqueue((to, htmlBody));
        return Task.CompletedTask;
    }

    public string LastLinkSentTo(string to)
    {
        var html = _sent.Last(e => e.To == to && LinkPattern().IsMatch(e.Html)).Html;
        return LinkPattern().Match(html).Groups[1].Value;
    }

    [GeneratedRegex("href=\"([^\"]+)\"")]
    private static partial Regex LinkPattern();
}
