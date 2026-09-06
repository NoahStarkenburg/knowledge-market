namespace Contracts.Identity;

public sealed record UpdateProfileRequest(string? DisplayName, string? CurrentPassword, string? NewPassword, string? NewEmail);
