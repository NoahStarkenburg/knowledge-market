namespace Api.Observability;

// Logs get shipped to Loki, retained, and read by whoever has Grafana. Email addresses are
// personal data and, on failed logins, are attacker-supplied - so they are masked before they
// leave the process. Enough of the address survives to correlate a support ticket; not enough
// to hand someone a mailing list or a credential-stuffing wordlist.
public static class LogSanitizer
{
    public static string MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return "(none)";

        var at = email.IndexOf('@');
        if (at <= 0) return "(invalid)";

        var local = email[..at];
        var domain = email[(at + 1)..];
        var head = local.Length <= 2 ? local[..1] : local[..2];

        return $"{head}{new string('*', Math.Max(1, local.Length - head.Length))}@{domain}";
    }
}
