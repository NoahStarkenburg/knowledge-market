using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Application.Abstractions;

namespace Infrastructure.Email;

public sealed class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _cfg;

    public SmtpEmailService(IConfiguration cfg) => _cfg = cfg;

    public async Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
    {
        var msg = new MimeMessage();
        msg.From.Add(MailboxAddress.Parse(_cfg["Email:From"]));
        msg.To.Add(MailboxAddress.Parse(to));
        msg.Subject = subject;
        msg.Body = new TextPart("html") { Text = htmlBody };

        using var smtp = new SmtpClient();
        await smtp.ConnectAsync(
            _cfg["Email:Host"],
            int.Parse(_cfg["Email:Port"] ?? "587"),
            SecureSocketOptions.StartTls, ct);

        var user = _cfg["Email:User"];
        var pass = _cfg["Email:Password"];
        if (!string.IsNullOrEmpty(user))
            await smtp.AuthenticateAsync(user, pass, ct);

        await smtp.SendAsync(msg, ct);
        await smtp.DisconnectAsync(true, ct);
    }
}
