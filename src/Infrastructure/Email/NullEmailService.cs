using Microsoft.Extensions.Logging;
using Application.Abstractions;

namespace Infrastructure.Email;

// Used in development - logs instead of sending
public sealed class NullEmailService : IEmailService
{
    private readonly ILogger<NullEmailService> _logger;

    public NullEmailService(ILogger<NullEmailService> logger) => _logger = logger;

    public Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
    {
        _logger.LogInformation("[Email:Dev] To={To} Subject={Subject}", to, subject);
        return Task.CompletedTask;
    }
}
