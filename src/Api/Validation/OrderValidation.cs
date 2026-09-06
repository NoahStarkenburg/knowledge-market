using System.Text.RegularExpressions;
using Domain.Contracts.Orders;

namespace Api.Validation
{
    public static class OrderValidation
    {
        private static readonly Regex AltToken = new(@"^[A-Za-z0-9_\-]{8,64}$", RegexOptions.Compiled);
        private const int IdemMin = 8;
        private const int IdemMax = 64;

        // Validating the PurchaseCourseRequest
        public static Dictionary<string, string[]> Validate(PurchaseCourseRequest? req, string? idempotencyKey)
        {
            var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);

            if (req is null)
            {
                Add(errors, "body", "Request body is required.");
                return errors;
            }

            if (req.CourseId == Guid.Empty)
                Add(errors, "courseId", "courseId is required.");

            var key = idempotencyKey?.Trim();

            if (string.IsNullOrWhiteSpace(key))
            {
                Add(errors, "Idempotency-Key", "Idempotency-Key header is required.");
            }
            else
            {
                if (key.Length < IdemMin || key.Length > IdemMax)
                    Add(errors, "Idempotency-Key", $"Idempotency-Key must be between {IdemMin} and {IdemMax} characters.");

                // Prefer GUIDs; allow simple safe tokens as a fallback.
                if (!Guid.TryParse(key, out _) && !AltToken.IsMatch(key))
                    Add(errors, "Idempotency-Key", "Idempotency-Key must be a GUID or an 8–64 char token (A–Z, a–z, 0–9, _ or -).");
            }

            return errors;

        }

        public static Dictionary<string, string[]> ValidateListQuery(int page, int pageSize)
        {
            var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
            if (page < 1) Add(errors, "page", "page must be >= 1.");
            if (pageSize < 1 || pageSize > 100) Add(errors, "pageSize", "pageSize must be between 1 and 100.");
            return errors;
        }


        private static void Add(Dictionary<string, string[]> dict, string key, string message)
        {
            if (dict.TryGetValue(key, out var existing))
                dict[key] = existing.Concat(new[] { message }).ToArray();
            else
                dict[key] = new[] { message };
        }
    }
}
