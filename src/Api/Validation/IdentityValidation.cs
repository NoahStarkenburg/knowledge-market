using System.Text.RegularExpressions;
using Contracts.Identity;

namespace Api.Validation;

public static partial class IdentityValidation
{
    // RFC 5322-simplified: local@domain.tld — fast, bounded timeout
    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.IgnoreCase)]
    private static partial Regex EmailRegex();

    public static Dictionary<string, string[]> Validate(RegisterUserRequest req)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(req.Email))
        {
            errors["email"] = ["Email is required."];
            return errors;
        }

        if (req.Email.Length > 200)
        {
            errors["email"] = ["Email must be at most 200 characters."];
            return errors;
        }

        if (!EmailRegex().IsMatch(req.Email))
            errors["email"] = ["Email is not a valid email address."];

        if (string.IsNullOrWhiteSpace(req.Password))
            errors["password"] = ["Password is required."];
        else if (req.Password.Length < 8)
            errors["password"] = ["Password must be at least 8 characters."];
        else if (req.Password.Length > 100)
            errors["password"] = ["Password must be at most 100 characters."];

        return errors;
    }
}
