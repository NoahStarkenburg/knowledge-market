using System.Security.Claims;
using Application.Abstractions;
using Shared.Abstractions;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Amazon.S3;
using Api.Authorization;
using Api.Authorization.AccessService;
using Api.Authorization.Handlers;
using Api.Authorization.Policies;
using Api.Configuration;
using Infrastructure.Storage;
using Api.DataSeeding;
using Infrastructure.Email;
using Api.Endpoints;
using Infrastructure.Payments;
using Infrastructure.Storage;
using Infrastructure.Catalog;
using Infrastructure.Content;
using Infrastructure.Identity;
using Infrastructure.Orders;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;
using FluentValidation;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog.Sinks.OpenTelemetry;
using Api.Observability;
using Shared.Kernel;
using Infrastructure.Cart;

namespace Api.Endpoints;

// Authentication endpoints: login, registration, token refresh, logout, email
// verification and password reset, plus the optional Google OAuth flow.
// Kept as minimal APIs rather than a controller because they are a self-contained
// security module that predates the controller conversion.
public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app, IWebHostEnvironment env, bool googleEnabled)
    {
        // Auth endpoints: login issues cookie JWT + CSRF cookie
        var auth = app.MapGroup("/api/auth").WithTags("Auth");

        auth.MapPost("/login", async (
            [FromBody] LoginRequest req,
            HttpContext http,
            UsersDbContext db,
            ITokenService tokens,
            AppMetrics metrics,
            CancellationToken ct) =>
        {
            string emailValue;
            try { emailValue = Domain.Identity.Email.Create(req.Email).Value; }
            catch { return Results.Unauthorized(); }

            var user = await db.Users
                .Include(u => u.Roles)
                .FirstOrDefaultAsync(u => u.Email.Value == emailValue, ct);

            // Don't reveal whether the email exists
            if (user is null)
            {
                Log.Warning("Login failed for {Email}", LogSanitizer.MaskEmail(req.Email));
                return Results.Unauthorized();
            }

            if (user.IsLockedOut)
            {
                Log.Warning("Login blocked (locked out) for user {UserId}", user.Id);
                return Results.Json(
                    new { message = "Account temporarily locked after too many failed attempts. Try again in a few minutes." },
                    statusCode: StatusCodes.Status429TooManyRequests);
            }

            if (!user.VerifyPassword(req.Password))
            {
                user.RegisterFailedLogin();
                await db.SaveChangesAsync(ct);
                metrics.RecordLogin(false);
                Log.Warning("Login failed for {Email}", LogSanitizer.MaskEmail(req.Email));
                return Results.Unauthorized();
            }

            user.RegisterSuccessfulLogin();
            await db.SaveChangesAsync(ct);
            metrics.RecordLogin(true);

            Log.Information("Login succeeded for user {UserId}", user.Id);

            var roles = user.Roles.Select(r => r.Name).ToList();
            var accessToken = await tokens.Create(user.Id, user.Email.Value);
            var refreshToken = await tokens.CreateRefreshTokenAsync(user.Id, ct);

            http.Response.Cookies.Append(AuthCookies.AccessTokenCookie, accessToken,
                CookieHelpers.Auth(env, TimeSpan.FromMinutes(15)));

            http.Response.Cookies.Append(AuthCookies.RefreshTokenCookie, refreshToken,
                CookieHelpers.Auth(env, TimeSpan.FromDays(7), path: "/api/auth"));

            var csrfBytes = RandomNumberGenerator.GetBytes(32);
            var csrf = Microsoft.IdentityModel.Tokens.Base64UrlEncoder.Encode(csrfBytes);

            http.Response.Cookies.Append(AuthCookies.CsrfCookie, csrf,
                CookieHelpers.Csrf(env, TimeSpan.FromDays(7)));

            return Results.Ok(new { userId = user.Id, email = user.Email.Value, csrf, isEmailVerified = user.IsEmailVerified, roles, displayName = user.DisplayName });
        })
        .AllowAnonymous()
        .RequireRateLimiting("login");

        // Google OAuth: /start redirects to Google; Google returns to /signin-google (handled by the
        // middleware) which redirects to /callback, where we find-or-create the user and issue our own
        // cookies. Only mapped when Google is configured.
        if (googleEnabled)
        {
            auth.MapGet("/google/start", (HttpContext http) =>
                Results.Challenge(
                    new AuthenticationProperties { RedirectUri = "/api/auth/google/callback" },
                    new[] { "Google" }))
            .AllowAnonymous();

            auth.MapGet("/google/callback", async (
                HttpContext http,
                UsersDbContext db,
                ITokenService tokens,
                IConfiguration cfg,
                CancellationToken ct) =>
            {
                var frontendUrl = cfg["Cors:FrontendOrigin"] ?? "http://localhost:4200";

                var result = await http.AuthenticateAsync("External");
                if (!result.Succeeded || result.Principal is null)
                    return Results.Redirect($"{frontendUrl}/login?error=google");

                var email = result.Principal.FindFirstValue(ClaimTypes.Email);
                var subject = result.Principal.FindFirstValue(ClaimTypes.NameIdentifier);
                var name = result.Principal.FindFirstValue(ClaimTypes.Name);
                if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(subject))
                    return Results.Redirect($"{frontendUrl}/login?error=google");

                string emailValue;
                try { emailValue = Domain.Identity.Email.Create(email).Value; }
                catch { return Results.Redirect($"{frontendUrl}/login?error=google"); }

                var user = await db.Users.FirstOrDefaultAsync(u => u.Email.Value == emailValue, ct);
                if (user is null)
                {
                    user = Domain.Identity.User.RegisterExternal(emailValue, "google", subject);
                    if (!string.IsNullOrWhiteSpace(name) && name.Length <= 100) user.SetDisplayName(name);
                    db.Users.Add(user);
                }
                else if (user.ExternalId is null)
                {
                    user.LinkExternal("google", subject);
                }
                await db.SaveChangesAsync(ct);

                await http.SignOutAsync("External");

                var accessToken = await tokens.Create(user.Id, user.Email.Value);
                var refreshToken = await tokens.CreateRefreshTokenAsync(user.Id, ct);

                http.Response.Cookies.Append(AuthCookies.AccessTokenCookie, accessToken,
                    CookieHelpers.Auth(env, TimeSpan.FromMinutes(15)));
                http.Response.Cookies.Append(AuthCookies.RefreshTokenCookie, refreshToken,
                    CookieHelpers.Auth(env, TimeSpan.FromDays(7), path: "/api/auth"));

                var csrfBytes = RandomNumberGenerator.GetBytes(32);
                var csrf = Microsoft.IdentityModel.Tokens.Base64UrlEncoder.Encode(csrfBytes);
                http.Response.Cookies.Append(AuthCookies.CsrfCookie, csrf,
                    CookieHelpers.Csrf(env, TimeSpan.FromDays(7)));

                return Results.Redirect($"{frontendUrl}/auth/callback");
            })
            .AllowAnonymous();
        }

        auth.MapPost("/register", async (
            [FromBody] RegisterRequest req,
            HttpContext http,
            UsersDbContext db,
            ITokenService tokens,
            IEmailService emailSvc,
            IConfiguration cfg,
            AppMetrics metrics,
            CancellationToken ct) =>
        {
            string emailValue;
            try { emailValue = Domain.Identity.Email.Create(req.Email).Value; }
            catch { return Results.BadRequest(new { message = "Invalid email address." }); }

            var exists = await db.Users.AnyAsync(u => u.Email.Value == emailValue, ct);
            if (exists)
                return Results.Conflict(new { message = "An account with that email already exists." });

            var user = Domain.Identity.User.Register(emailValue, req.Password);
            db.Users.Add(user);
            await db.SaveChangesAsync(ct);
            metrics.RecordRegistration();

            Log.Information("User registered {UserId} {Email}", user.Id, LogSanitizer.MaskEmail(emailValue));

            // Send verification email (fire-and-forget — don't fail registration if email fails)
            var frontendUrl = cfg["Cors:FrontendOrigin"] ?? "http://localhost:4200";
            var verifyUrl = $"{http.Request.Scheme}://{http.Request.Host}/api/auth/verify-email?token={Uri.EscapeDataString(user.VerificationToken!)}";
            _ = emailSvc.SendAsync(user.Email.Value, "Verify your KnowledgeMarket email",
                EmailTemplates.VerifyEmail(verifyUrl), ct);

            // Issue tokens so user is immediately logged in
            var accessToken = await tokens.Create(user.Id, user.Email.Value);
            var refreshToken = await tokens.CreateRefreshTokenAsync(user.Id, ct);

            http.Response.Cookies.Append(AuthCookies.AccessTokenCookie, accessToken,
                CookieHelpers.Auth(env, TimeSpan.FromMinutes(15)));

            http.Response.Cookies.Append(AuthCookies.RefreshTokenCookie, refreshToken,
                CookieHelpers.Auth(env, TimeSpan.FromDays(7), path: "/api/auth"));

            var csrfBytes = RandomNumberGenerator.GetBytes(32);
            var csrf = Microsoft.IdentityModel.Tokens.Base64UrlEncoder.Encode(csrfBytes);
            http.Response.Cookies.Append(AuthCookies.CsrfCookie, csrf,
                CookieHelpers.Csrf(env, TimeSpan.FromDays(7)));

            return Results.Ok(new { userId = user.Id, email = user.Email.Value, csrf });
        })
        .AllowAnonymous()
        .RequireRateLimiting("register");

        auth.MapPost("/refresh", async (
            HttpContext http,
            ITokenService tokens,
            UsersDbContext db,
            CancellationToken ct) =>
        {
            var rawRefreshToken = http.Request.Cookies[AuthCookies.RefreshTokenCookie];
            if (string.IsNullOrWhiteSpace(rawRefreshToken))
                return Results.Unauthorized();

            var result = await tokens.RotateRefreshTokenAsync(rawRefreshToken, ct);
            if (result is null)
                return Results.Unauthorized();

            var (userId, newRefreshToken) = result.Value;

            var userEmail = await db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => u.Email.Value)
                .FirstOrDefaultAsync(ct);

            if (userEmail is null) return Results.Unauthorized();

            var newAccessToken = await tokens.Create(userId, userEmail);

            http.Response.Cookies.Append(AuthCookies.AccessTokenCookie, newAccessToken,
                CookieHelpers.Auth(env, TimeSpan.FromMinutes(15)));

            http.Response.Cookies.Append(AuthCookies.RefreshTokenCookie, newRefreshToken,
                CookieHelpers.Auth(env, TimeSpan.FromDays(7), path: "/api/auth"));

            return Results.Ok(new { ok = true });
        })
        .AllowAnonymous();

        auth.MapPost("/logout", async (HttpContext http, ITokenService tokens, CancellationToken ct) =>
        {
            var rawRefreshToken = http.Request.Cookies[AuthCookies.RefreshTokenCookie];
            if (!string.IsNullOrWhiteSpace(rawRefreshToken))
                await tokens.RevokeRefreshTokenAsync(rawRefreshToken, ct);

            http.Response.Cookies.Delete(AuthCookies.AccessTokenCookie, CookieHelpers.Delete(env));
            http.Response.Cookies.Delete(AuthCookies.RefreshTokenCookie, CookieHelpers.Delete(env, path: "/api/auth"));
            http.Response.Cookies.Delete(AuthCookies.CsrfCookie, CookieHelpers.Delete(env));
            return Results.Ok(new { ok = true });
        })
        .AllowAnonymous();

        auth.MapGet("/verify-email", async (
            [FromQuery] string token,
            UsersDbContext db,
            IConfiguration cfg,
            CancellationToken ct) =>
        {
            var frontendUrl = cfg["Cors:FrontendOrigin"] ?? "http://localhost:4200";

            if (string.IsNullOrWhiteSpace(token))
                return Results.Redirect($"{frontendUrl}/verify-email?error=invalid");

            var user = await db.Users
                .FirstOrDefaultAsync(u => u.VerificationToken == token, ct);

            if (user is null)
                return Results.Redirect($"{frontendUrl}/verify-email?error=invalid");

            if (!user.VerifyEmail(token))
                return Results.Redirect($"{frontendUrl}/verify-email?error=expired");

            await db.SaveChangesAsync(ct);
            return Results.Redirect($"{frontendUrl}/verify-email?success=true");
        })
        .AllowAnonymous();

        auth.MapPost("/resend-verification", async (
            HttpContext http,
            UsersDbContext db,
            IEmailService email,
            ICurrentUser me,
            IConfiguration cfg,
            CancellationToken ct) =>
        {
            var userId = await me.GetRequiredUserIdAsync(ct);
            if (userId == Guid.Empty) return Results.Unauthorized();

            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
            if (user is null) return Results.Unauthorized();
            if (user.IsEmailVerified) return Results.BadRequest(new { message = "Email already verified." });

            user.RegenerateVerificationToken();
            await db.SaveChangesAsync(ct);

            var frontendUrl = cfg["Cors:FrontendOrigin"] ?? "http://localhost:4200";
            var verifyUrl = $"{frontendUrl}/verify-email?token={Uri.EscapeDataString(user.VerificationToken!)}";
            _ = email.SendAsync(user.Email.Value, "Verify your KnowledgeMarket email",
                EmailTemplates.VerifyEmail(verifyUrl), ct);

            return Results.Ok(new { ok = true });
        })
        .RequireAuthorization();

        auth.MapPost("/forgot-password", async (
            [FromBody] ForgotPasswordRequest req,
            UsersDbContext db,
            IEmailService emailSvc,
            IConfiguration cfg,
            CancellationToken ct) =>
        {
            // Always return 200 — never reveal whether the email exists
            if (!string.IsNullOrWhiteSpace(req.Email))
            {
                string emailValue;
                try { emailValue = Domain.Identity.Email.Create(req.Email).Value; }
                catch { return Results.Ok(new { ok = true }); }

                var user = await db.Users.FirstOrDefaultAsync(u => u.Email.Value == emailValue, ct);
                if (user is not null)
                {
                    var rawResetToken = user.RequestPasswordReset();
                    await db.SaveChangesAsync(ct);

                    Log.Information("Password reset requested for user {UserId}", user.Id);

                    var frontendUrl = cfg["Cors:FrontendOrigin"] ?? "http://localhost:4200";
                    var resetUrl = $"{frontendUrl}/reset-password?token={Uri.EscapeDataString(rawResetToken)}";
                    _ = emailSvc.SendAsync(user.Email.Value, "Reset your KnowledgeMarket password",
                        EmailTemplates.PasswordReset(resetUrl), ct);
                }
            }
            return Results.Ok(new { ok = true });
        })
        .AllowAnonymous()
        .RequireRateLimiting("register");

        auth.MapPost("/reset-password", async (
            [FromBody] ResetPasswordRequest req,
            UsersDbContext db,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(req.Token) || string.IsNullOrWhiteSpace(req.NewPassword))
                return Results.BadRequest(new { message = "Token and new password are required." });

            if (req.NewPassword.Length < 8)
                return Results.BadRequest(new { message = "Password must be at least 8 characters." });

            var tokenHash = Domain.Identity.User.HashToken(req.Token);
            var user = await db.Users.FirstOrDefaultAsync(u => u.PasswordResetToken == tokenHash, ct);
            if (user is null)
                return Results.BadRequest(new { message = "Link expired or invalid." });

            if (!user.ResetPassword(req.Token, req.NewPassword))
                return Results.BadRequest(new { message = "Link expired or invalid." });

            await db.SaveChangesAsync(ct);
            return Results.Ok(new { ok = true });
        })
        .AllowAnonymous();

        return app;
    }
}
