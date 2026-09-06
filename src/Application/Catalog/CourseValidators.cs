using Domain.Contracts.Catalog;
using FluentValidation;

namespace Application.Catalog;

// Mirror the original CatalogValidators rules and error keys.
public sealed class CreateCourseRequestValidator : AbstractValidator<CreateCourseRequest>
{
    public CreateCourseRequestValidator()
    {
        RuleFor(x => x.Title)
            .Must(t => !string.IsNullOrWhiteSpace(t) && t.Length is >= 3 and <= 200)
            .WithMessage("Title is required and should be at most 200 characters long.")
            .OverridePropertyName("title");

        RuleFor(x => x.PriceAmount)
            .Must(p => p is >= 0 and <= 1000)
            .WithMessage("Price amount should be between 0 and 1000.")
            .OverridePropertyName("priceAmount");

        RuleFor(x => x.PriceCurrency)
            .Must(c => !string.IsNullOrWhiteSpace(c) && c.Length == 3 && c.All(char.IsLetter))
            .WithMessage("Price currency is required and should be a 3-letter ISO currency code.")
            .OverridePropertyName("priceCurrency");
    }
}

public sealed class UpdateCourseRequestValidator : AbstractValidator<UpdateCourseRequest>
{
    public UpdateCourseRequestValidator()
    {
        When(x => x.Title is not null, () =>
            RuleFor(x => x.Title!)
                .Must(t => t.Trim().Length is >= 3 and <= 200)
                .WithMessage("If provided, title should be 3-200 characters long.")
                .OverridePropertyName("title"));

        When(x => x.PriceAmount is not null, () =>
            RuleFor(x => x.PriceAmount!.Value)
                .Must(p => p is >= 0 and <= 1000)
                .WithMessage("If provided, price amount should be between 0 and 1000.")
                .OverridePropertyName("priceAmount"));

        When(x => x.PriceCurrency is not null, () =>
            RuleFor(x => x.PriceCurrency!)
                .Must(c => c.Trim().Length == 3 && c.Trim().All(char.IsLetter))
                .WithMessage("If provided, price currency should be a 3-letter ISO currency code.")
                .OverridePropertyName("priceCurrency"));
    }
}
