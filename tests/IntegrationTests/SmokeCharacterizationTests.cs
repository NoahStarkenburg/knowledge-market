using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Domain.Catalog;
using Infrastructure.Catalog;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests;

// Records the CURRENT HTTP behavior of the cross-cutting paths (auth, CSRF, cookies, the
// free-order rule, idempotency) so the layered refactor can be proven non-breaking.
// Per-context tests are added just before each context is converted.
[Collection("api")]
public class SmokeCharacterizationTests
{
    private readonly ApiFactory _factory;

    public SmokeCharacterizationTests(ApiFactory factory) => _factory = factory;

    private static string NewEmail(string prefix) => $"{prefix}-{Guid.NewGuid():N}@test.local";

    private async Task<HttpClient> RegisterAndAuthAsync(string email)
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/auth/register", new { email, password = "Password123!" });
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var csrf = body.GetProperty("csrf").GetString()!;
        client.DefaultRequestHeaders.Add("X-CSRF", csrf);
        return client;
    }

    private async Task<Guid> SeedFreePublishedCourseAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
        var course = Course.Create("Free Characterization Course", "desc", 0m, "USD", Guid.NewGuid());
        course.Publish();
        db.Courses.Add(course);
        await db.SaveChangesAsync();
        return course.Id;
    }

    [Fact]
    public async Task Health_returns_ok()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task Register_issues_session_cookie_and_csrf()
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/auth/register",
            new { email = NewEmail("reg"), password = "Password123!" });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("csrf").GetString()));
        Assert.Contains(resp.Headers.GetValues("Set-Cookie"), c => c.StartsWith("km_at="));
    }

    [Fact]
    public async Task Login_succeeds_with_good_password_and_rejects_bad()
    {
        var email = NewEmail("login");
        var reg = _factory.CreateClient();
        (await reg.PostAsJsonAsync("/api/auth/register", new { email, password = "Password123!" }))
            .EnsureSuccessStatusCode();

        var client = _factory.CreateClient();
        var ok = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "Password123!" });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);

        var bad = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "wrong-password" });
        Assert.Equal(HttpStatusCode.Unauthorized, bad.StatusCode);
    }

    [Fact]
    public async Task Debug_me_requires_auth_then_reports_authenticated()
    {
        var anon = _factory.CreateClient();
        var unauthorized = await anon.GetAsync("/api/debug/me");
        Assert.Equal(HttpStatusCode.Unauthorized, unauthorized.StatusCode);

        var client = await RegisterAndAuthAsync(NewEmail("me"));
        var me = await client.GetAsync("/api/debug/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        var body = await me.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("isAuthenticated").GetBoolean());
    }

    [Fact]
    public async Task Free_course_purchase_is_marked_paid_and_is_idempotent()
    {
        var courseId = await SeedFreePublishedCourseAsync();
        var client = await RegisterAndAuthAsync(NewEmail("buy"));
        var key = Guid.NewGuid().ToString();

        var first = await PurchaseAsync(client, courseId, key);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var firstBody = await first.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Paid", firstBody.GetProperty("status").GetString());
        var firstId = firstBody.GetProperty("id").GetGuid();

        // Replaying the same Idempotency-Key returns the same order, not a new one.
        var second = await PurchaseAsync(client, courseId, key);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        var secondBody = await second.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(firstId, secondBody.GetProperty("id").GetGuid());
    }

    private static Task<HttpResponseMessage> PurchaseAsync(HttpClient client, Guid courseId, string idempotencyKey)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/orders")
        {
            Content = JsonContent.Create(new { courseId })
        };
        req.Headers.Add("Idempotency-Key", idempotencyKey);
        return client.SendAsync(req);
    }
}
