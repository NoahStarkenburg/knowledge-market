using System.Text.RegularExpressions;
using Domain.Contracts.Identity;
using FluentValidation;

namespace Application.Users;

// Mirrors the original IdentityValidation rules. Error keys are lowercased to match the
// previous ValidationProblem shape the frontend consumes.
public sealed partial class RegisterUserRequestValidator : AbstractValidator<RegisterUserRequest>
{
    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.IgnoreCase)]
    private static partial Regex EmailRegex();

    public RegisterUserRequestValidator()
    {
        RuleFor(x => x.Email)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Email is required.")
            .MaximumLength(200).WithMessage("Email must be at most 200 characters.")
            .Must(e => EmailRegex().IsMatch(e)).WithMessage("Email is not a valid email address.")
            .OverridePropertyName("email");

        RuleFor(x => x.Password)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Password is required.")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters.")
            .MaximumLength(100).WithMessage("Password must be at most 100 characters.")
            .OverridePropertyName("password");
    }
}
