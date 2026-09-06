namespace Api.Auth;

public static class CookieHelpers
{
    static SameSiteMode SiteMode(IWebHostEnvironment env)
        => env.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.None;

    static bool SecureFlag(IWebHostEnvironment env) => !env.IsDevelopment();

    public static CookieOptions Auth(IWebHostEnvironment env, TimeSpan expires, string path = "/")
        => new()
        {
            HttpOnly = true,
            Secure = SecureFlag(env),
            SameSite = SiteMode(env),
            Path = path,
            Expires = DateTimeOffset.UtcNow.Add(expires),
        };

    public static CookieOptions Csrf(IWebHostEnvironment env, TimeSpan expires)
        => new()
        {
            HttpOnly = false,
            Secure = SecureFlag(env),
            SameSite = SiteMode(env),
            Path = "/",
            Expires = DateTimeOffset.UtcNow.Add(expires),
        };

    public static CookieOptions Delete(IWebHostEnvironment env, string path = "/")
        => new()
        {
            Secure = SecureFlag(env),
            SameSite = SiteMode(env),
            Path = path,
        };
}
