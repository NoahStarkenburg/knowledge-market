using System.Security.Cryptography;

namespace Domain.Identity;

public sealed class RefreshToken
{
    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public string Token { get; private set; } = null!;
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? RevokedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    private RefreshToken() { }

    public static (RefreshToken Entity, string RawToken) Create(Guid userId, TimeSpan lifetime)
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        var entity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Token = Hash(raw),
            ExpiresAt = DateTimeOffset.UtcNow.Add(lifetime),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        return (entity, raw);
    }

    // Only a hash of the token is stored; the raw value lives in the client's cookie.
    // A leaked database therefore can't be used to resume sessions.
    public static string Hash(string rawToken)
        => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(rawToken)));

    public bool IsActive => RevokedAt is null && DateTimeOffset.UtcNow < ExpiresAt;

    public void Revoke() => RevokedAt = DateTimeOffset.UtcNow;
}
