using Domain.Identity;

namespace UnitTests;

public class AuthHardeningTests
{
    [Fact]
    public void RefreshToken_Create_stores_hash_not_raw()
    {
        var (entity, raw) = RefreshToken.Create(Guid.NewGuid(), TimeSpan.FromDays(7));

        Assert.NotEqual(raw, entity.Token);
        Assert.Equal(RefreshToken.Hash(raw), entity.Token);
    }

    [Fact]
    public void RefreshToken_Hash_is_deterministic_and_distinct()
    {
        Assert.Equal(RefreshToken.Hash("abc"), RefreshToken.Hash("abc"));
        Assert.NotEqual(RefreshToken.Hash("abc"), RefreshToken.Hash("abd"));
    }

    [Fact]
    public void User_locks_out_after_five_failed_logins()
    {
        var user = User.Register("lock@example.com", "password123");

        for (var i = 0; i < 4; i++) user.RegisterFailedLogin();
        Assert.False(user.IsLockedOut);

        user.RegisterFailedLogin(); // fifth attempt
        Assert.True(user.IsLockedOut);
    }

    [Fact]
    public void Successful_login_clears_failed_attempts()
    {
        var user = User.Register("clear@example.com", "password123");
        user.RegisterFailedLogin();
        user.RegisterFailedLogin();

        user.RegisterSuccessfulLogin();

        Assert.Equal(0, user.FailedLoginCount);
        Assert.False(user.IsLockedOut);
    }

    [Fact]
    public void Reset_token_is_stored_hashed_and_verified_by_raw()
    {
        var user = User.Register("reset@example.com", "password123");

        var raw = user.RequestPasswordReset();

        Assert.NotEqual(raw, user.PasswordResetToken);
        Assert.Equal(User.HashToken(raw), user.PasswordResetToken);

        Assert.False(user.ResetPassword("wrong-token", "newpassword123"));
        Assert.True(user.ResetPassword(raw, "newpassword123"));
        Assert.True(user.VerifyPassword("newpassword123"));
    }

    [Fact]
    public void RegisterExternal_creates_passwordless_verified_user()
    {
        var user = User.RegisterExternal("g@example.com", "google", "sub-123");

        Assert.Null(user.PasswordHash);
        Assert.True(user.IsEmailVerified);
        Assert.Equal("google", user.ExternalProvider);
        Assert.Equal("sub-123", user.ExternalId);
    }
}
