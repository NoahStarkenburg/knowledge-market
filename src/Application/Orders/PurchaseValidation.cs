using System.Text.RegularExpressions;
using Domain.Contracts.Orders;
using FluentValidation;
using FluentValidation.Results;

namespace Application.Orders;

// Ported from the original OrderValidation: validates the purchase body and the
// Idempotency-Key header together, preserving the original error keys.
internal static partial class PurchaseValidation
{
    [GeneratedRegex(@"^[A-Za-z0-9_\-]{8,64}$")]
    private static partial Regex AltToken();

    private const int IdemMin = 8;
    private const int IdemMax = 64;

    public static void Validate(PurchaseCourseRequest? req, string? idempotencyKey)
    {
        var failures = new List<ValidationFailure>();

        if (req is null)
        {
            failures.Add(new ValidationFailure("body", "Request body is required."));
            throw new ValidationException(failures);
        }

        if (req.CourseId == Guid.Empty)
            failures.Add(new ValidationFailure("courseId", "courseId is required."));

        var key = idempotencyKey?.Trim();
        if (string.IsNullOrWhiteSpace(key))
        {
            failures.Add(new ValidationFailure("Idempotency-Key", "Idempotency-Key header is required."));
        }
        else
        {
            if (key.Length < IdemMin || key.Length > IdemMax)
                failures.Add(new ValidationFailure("Idempotency-Key", $"Idempotency-Key must be between {IdemMin} and {IdemMax} characters."));

            if (!Guid.TryParse(key, out _) && !AltToken().IsMatch(key))
                failures.Add(new ValidationFailure("Idempotency-Key", "Idempotency-Key must be a GUID or an 8–64 char token (A–Z, a–z, 0–9, _ or -)."));
        }

        if (failures.Count > 0)
            throw new ValidationException(failures);
    }
}
