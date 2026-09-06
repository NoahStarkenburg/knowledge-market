// FILE: src/Api/Auth/AuthCookies.cs
namespace Api.Authorization;

public static class AuthCookies
{
    public const string AccessTokenCookie = "km_at";   // HttpOnly JWT (15 min)
    public const string RefreshTokenCookie = "km_rt";  // HttpOnly refresh token (7 days)
    public const string CsrfCookie = "km_csrf";        // readable by JS
    public const string CsrfHeader = "X-CSRF";
}
