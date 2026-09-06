using System.Security.Cryptography;

namespace Domain.Identity;

public sealed class User
{
    public Guid Id { get; set; }
    public Email Email { get; private set; }
    public string? PasswordHash { get; private set; }
    public ICollection<Role> Roles { get; set; } = new List<Role>();
    public DateTimeOffset RegisteredAt { get; private set; }

    public DateTimeOffset? EmailVerifiedAt { get; private set; }
    public string? VerificationToken { get; private set; }
    public DateTimeOffset? VerificationTokenExpiresAt { get; private set; }

    public string? PasswordResetToken { get; private set; }
    public DateTimeOffset? PasswordResetTokenExpiresAt { get; private set; }

    public string? StripeCustomerId { get; private set; }
    public string? DisplayName { get; private set; }

    public int FailedLoginCount { get; private set; }
    public DateTimeOffset? LockoutEnd { get; private set; }
    public bool IsLockedOut => LockoutEnd is not null && DateTimeOffset.UtcNow < LockoutEnd;

    public string? ExternalProvider { get; private set; }
    public string? ExternalId { get; private set; }

    public bool IsEmailVerified => EmailVerifiedAt is not null;

    public void SetStripeCustomerId(string customerId)
    {
        StripeCustomerId = customerId;
    }

    public void SetDisplayName(string? name)
    {
        if (name is not null && name.Length > 100)
            throw new ArgumentException("Display name must be 100 characters or fewer.");
        DisplayName = name?.Trim();
    }

    public void ChangeEmail(string newEmail)
    {
        Email = Email.Create(newEmail);
        EmailVerifiedAt = null;
        RegenerateVerificationToken();
    }

    public bool ChangePassword(string currentPassword, string newPassword)
    {
        if (!VerifyPassword(currentPassword)) return false;
        if (newPassword.Length < 8) throw new ArgumentException("Password must be at least 8 characters.");
        SetPassword(newPassword);
        return true;
    }

    private User() { }
    private User(Guid id, Email email, DateTimeOffset registeredAt)
    {
        Id = id;
        Email = email;
        RegisteredAt = registeredAt;
    }

    public static User Register(string email, string password)
    {
        var user = new User(Guid.NewGuid(), Email.Create(email), DateTimeOffset.UtcNow);
        user.SetPassword(password);
        user.RegenerateVerificationToken();
        return user;
    }

    // External (OAuth) sign-up: no password; the provider has already verified the email.
    public static User RegisterExternal(string email, string provider, string externalId)
        => new(Guid.NewGuid(), Email.Create(email), DateTimeOffset.UtcNow)
        {
            ExternalProvider = provider,
            ExternalId = externalId,
            EmailVerifiedAt = DateTimeOffset.UtcNow,
        };

    public void LinkExternal(string provider, string externalId)
    {
        ExternalProvider = provider;
        ExternalId = externalId;
        EmailVerifiedAt ??= DateTimeOffset.UtcNow;
    }

    public void RegenerateVerificationToken()
    {
        VerificationToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-').Replace('/', '_').TrimEnd('='); // URL-safe
        VerificationTokenExpiresAt = DateTimeOffset.UtcNow.AddHours(24);
    }

    public bool VerifyEmail(string token)
    {
        if (IsEmailVerified) return true;
        if (VerificationToken is null || VerificationTokenExpiresAt is null) return false;
        if (DateTimeOffset.UtcNow > VerificationTokenExpiresAt) return false;
        if (!CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(token),
                System.Text.Encoding.UTF8.GetBytes(VerificationToken))) return false;

        EmailVerifiedAt = DateTimeOffset.UtcNow;
        VerificationToken = null;
        VerificationTokenExpiresAt = null;
        return true;
    }

    // Returns the raw token to email to the user; only its hash is persisted.
    public string RequestPasswordReset()
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-').Replace('/', '_').TrimEnd('='); // URL-safe
        PasswordResetToken = HashToken(raw);
        PasswordResetTokenExpiresAt = DateTimeOffset.UtcNow.AddHours(1);
        return raw;
    }

    public bool ResetPassword(string token, string newPassword)
    {
        if (PasswordResetToken is null || PasswordResetTokenExpiresAt is null) return false;
        if (DateTimeOffset.UtcNow > PasswordResetTokenExpiresAt) return false;
        if (!CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(HashToken(token)),
                System.Text.Encoding.UTF8.GetBytes(PasswordResetToken))) return false;
        SetPassword(newPassword);
        PasswordResetToken = null;
        PasswordResetTokenExpiresAt = null;
        return true;
    }

    // Reset tokens are stored hashed so a leaked database can't be used to take over accounts.
    public static string HashToken(string rawToken)
        => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(rawToken)));

    public void SetPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
        PasswordHash = $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public bool VerifyPassword(string password) => CheckPassword(PasswordHash, password);

    // Static overload for use when only the hash string is available (e.g. anonymous projections)
    public static bool CheckPassword(string? passwordHash, string password)
    {
        if (passwordHash is null) return false;
        var parts = passwordHash.Split('.');
        if (parts.Length != 2) return false;
        var salt = Convert.FromBase64String(parts[0]);
        var expected = Convert.FromBase64String(parts[1]);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
        return CryptographicOperations.FixedTimeEquals(expected, actual);
    }

    // ---- Account lockout ----
    private const int MaxFailedLoginAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    public void RegisterFailedLogin()
    {
        // A lapsed lockout resets the counter before this attempt is counted.
        if (LockoutEnd is not null && DateTimeOffset.UtcNow >= LockoutEnd)
        {
            FailedLoginCount = 0;
            LockoutEnd = null;
        }
        FailedLoginCount++;
        if (FailedLoginCount >= MaxFailedLoginAttempts)
            LockoutEnd = DateTimeOffset.UtcNow.Add(LockoutDuration);
    }

    public void RegisterSuccessfulLogin()
    {
        FailedLoginCount = 0;
        LockoutEnd = null;
    }
}
