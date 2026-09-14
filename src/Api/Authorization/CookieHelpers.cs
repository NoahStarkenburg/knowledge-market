namespace Api.Authorization;

public static class CookieHelpers
{
    // Lax in every environment. The SPA and the API are served from one origin (the Vite
    // dev proxy locally, nginx in containers, Front Door in production), so every API call
    // is same-site and Lax cookies are always sent with it.
    //
    // This used to be None outside Development, because the SPA was once served from a
    // different origin and None is the only value a browser attaches to cross-site requests.
    // None switches off the browser's own CSRF protection, and it is the third-party-cookie
    // setting browsers increasingly restrict. Lax makes the browser refuse to attach these
    // cookies to a POST started by another site.
    //
    // The CSRF double-submit token stays. Lax does not cover a same-site attacker, such as a
    // compromised subdomain, so the two are layers rather than alternatives.
    const SameSiteMode SiteMode = SameSiteMode.Lax;

    static bool SecureFlag(IWebHostEnvironment env) => !env.IsDevelopment();

    public static CookieOptions Auth(IWebHostEnvironment env, TimeSpan expires, string path = "/")
        => new()
        {
            HttpOnly = true,
            Secure = SecureFlag(env),
            SameSite = SiteMode,
            Path = path,
            Expires = DateTimeOffset.UtcNow.Add(expires),
        };

    public static CookieOptions Csrf(IWebHostEnvironment env, TimeSpan expires)
        => new()
        {
            HttpOnly = false,
            Secure = SecureFlag(env),
            SameSite = SiteMode,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.Add(expires),
        };

    public static CookieOptions Delete(IWebHostEnvironment env, string path = "/")
        => new()
        {
            Secure = SecureFlag(env),
            SameSite = SiteMode,
            Path = path,
        };
}
