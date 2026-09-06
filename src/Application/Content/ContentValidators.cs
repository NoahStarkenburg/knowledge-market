using Domain.Contracts.Content;
using FluentValidation;

namespace Application.Content;

// Mirrors the original ContentValidators rules. Error keys are lowercased ("title"/"body")
// to match the ValidationProblem shape the frontend already consumes.
public sealed class CreateLessonRequestValidator : AbstractValidator<CreateLessonRequest>
{
    public CreateLessonRequestValidator()
    {
        RuleFor(x => x.Title)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Title is required.")
            .Must(t => t.Length is >= 3 and <= 200).WithMessage("Title must be between 3 and 200 characters.")
            .OverridePropertyName("title");

        // Body is optional: the UI creates a lesson with an empty body and stores the intro
        // as a separate "Overview" text block (the lesson body is never surfaced back through
        // GetLessonContent). Requiring it here broke lesson creation from both frontends.
    }
}

public sealed class UpdateLessonRequestValidator : AbstractValidator<UpdateLessonRequest>
{
    public UpdateLessonRequestValidator()
    {
        RuleFor(x => x)
            .Must(x => x.Title is not null || x.IsFreePreview is not null || x.Body is not null)
            .WithMessage("At least one field (title, isFreePreview, body) must be provided.")
            .OverridePropertyName("body");

        When(x => x.Title is not null, () =>
        {
            RuleFor(x => x.Title)
                .Cascade(CascadeMode.Stop)
                .Must(t => !string.IsNullOrWhiteSpace(t)).WithMessage("Title cannot be empty.")
                .Must(t => t!.Length is >= 3 and <= 200).WithMessage("Title must be between 3 and 200 characters.")
                .OverridePropertyName("title");
        });

        When(x => x.Body is not null, () =>
        {
            RuleFor(x => x.Body)
                .Must(b => !string.IsNullOrWhiteSpace(b)).WithMessage("Body cannot be empty.")
                .OverridePropertyName("body");
        });
    }
}
