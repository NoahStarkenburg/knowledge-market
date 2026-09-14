namespace Api.Configuration;

public static class ProductionConfigValidator
{
    static readonly string[] PlaceholderMarkers =
    {
        "dev_only",
        "CHANGE_THIS",
        "YOUR_",
        "REPLACE_",
        "DevAdmin@LocalOnly",
        "knowledgemarket.local",
    };

    public static void Validate(IConfiguration cfg, IWebHostEnvironment env)
    {
        if (!env.IsProduction()) return;

        var problems = new List<string>();

        Check(cfg["Jwt:SigningKey"], "Jwt:SigningKey", minLength: 32, problems);
        Check(cfg["Admin:Password"], "Admin:Password", minLength: 12, problems);
        Check(cfg["Admin:Email"], "Admin:Email", minLength: 5, problems);
        // Despite the name, no longer a CORS setting: the app is single-origin. It is the public
        // base URL the API uses to build links in emails and sign-in redirects, so a missing one
        // would send users to localhost.
        Check(cfg["Cors:FrontendOrigin"], "Cors:FrontendOrigin", minLength: 8, problems);
        Check(cfg.GetConnectionString("Default"), "ConnectionStrings:Default", minLength: 20, problems);

        // Stripe is required in Production unless explicitly opted out with Stripe:Disabled=true.
        // This prevents a silent "deployed without Stripe" failure mode where the API boots but
        // checkout endpoints would throw 500 at runtime.
        var stripeDisabled = bool.TryParse(cfg["Stripe:Disabled"], out var d) && d;
        if (!stripeDisabled)
        {
            Check(cfg["Stripe:SecretKey"], "Stripe:SecretKey", minLength: 20, problems);
            Check(cfg["Stripe:PublishableKey"], "Stripe:PublishableKey", minLength: 20, problems);
            Check(cfg["Stripe:WebhookSecret"], "Stripe:WebhookSecret", minLength: 20, problems);
        }

        if (problems.Count > 0)
        {
            var msg = "Refusing to start in Production with insecure or missing configuration:\n  - "
                      + string.Join("\n  - ", problems)
                      + "\nSet each value via environment variable (e.g. Jwt__SigningKey=...).";
            throw new InvalidOperationException(msg);
        }
    }

    static void Check(string? value, string key, int minLength, List<string> problems)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            problems.Add($"{key} is missing");
            return;
        }

        if (value.Length < minLength)
        {
            problems.Add($"{key} is too short (need >= {minLength} chars)");
            return;
        }

        foreach (var marker in PlaceholderMarkers)
        {
            if (value.Contains(marker, StringComparison.OrdinalIgnoreCase))
            {
                problems.Add($"{key} still contains placeholder text '{marker}'");
                return;
            }
        }
    }
}
