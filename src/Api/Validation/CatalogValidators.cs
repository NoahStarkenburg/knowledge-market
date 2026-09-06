using Contracts.Catalog;
using Microsoft.Extensions.ObjectPool;

namespace Api.Validation
{
    public static class CatalogValidators
    {
        // Validating the CreateCourseRequest
        public static Dictionary<string, string[]> Validate(CreateCourseRequest req)
        {
            Dictionary<string, string[]> errors = new Dictionary<string, string[]>();

            if(string.IsNullOrWhiteSpace(req.Title) || req.Title.Length is < 3 or > 200)
                errors["title"] = new[] { "Title is required and should be at most 200 characters long." };

            if(req.PriceAmount < 0 || req.PriceAmount > 1000)
                errors["priceAmount"] = new[] { "Price amount should be between 0 and 1000." };

            if(string.IsNullOrWhiteSpace(req.PriceCurrency) || req.PriceCurrency.Length != 3 || !req.PriceCurrency.All(char.IsLetter))
                errors["priceCurrency"] = new[] { "Price currency is required and should be a 3-letter ISO currency code." };
            //
            return errors;
        }

        public static Dictionary<string, string[]> Validate(UpdateCourseRequest req)
        {
            Dictionary<string, string[]> errors = new Dictionary<string, string[]>();

            if(req.Title is not null)
            {
                var t = req.Title.Trim();
                if(t.Length is < 3 or > 200)
                    errors["title"] = new[] { "If provided, title should be 3-200 characters long." };
            }

            if (req.PriceAmount is not null)
            {
                if (req.PriceAmount < 0 || req.PriceAmount > 1000)
                    errors["priceAmount"] = new[] { "If provided, price amount should be between 0 and 1000." };
            }

            if (req.PriceCurrency is not null)
            {
                var c = req.PriceCurrency.Trim();
                if (c.Length != 3 || !c.All(char.IsLetter))
                    errors["priceCurrency"] = new[] { "If provided, price currency should be a 3-letter ISO currency code." };
            }

            return errors;
        }
    }
}
