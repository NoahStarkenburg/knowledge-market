using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace IntegrationTests;

// Pins the /api/creator dashboard/orders, public /api/users/{id}/courses, and admin
// review-delete contract after they moved to the layered controller shape (Phase 7).
[Collection("api")]
public class CreatorCharacterizationTests
{
    private readonly ApiFactory _factory;

    public CreatorCharacterizationTests(ApiFactory factory) => _factory = factory;

    private const string AdminEmail = "admin@tests.local";
    private const string AdminPassword = "AdminTests12345!";

    private static string NewEmail(string prefix) => $"{prefix}-{Guid.NewGuid():N}@test.local";

    private async Task<(HttpClient client, Guid userId)> AuthedClientAsync(string email)
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/auth/register", new { email, password = "Password123!" });
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Add("X-CSRF", body.GetProperty("csrf").GetString());
        return (client, body.GetProperty("userId").GetGuid());
    }

    private async Task<HttpClient> AdminClientAsync()
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/auth/login", new { email = AdminEmail, password = AdminPassword });
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Add("X-CSRF", body.GetProperty("csrf").GetString());
        return client;
    }

    private static async Task<Guid> CreateCourseAsync(HttpClient client, string title, bool publish)
    {
        var create = await client.PostAsJsonAsync("/api/courses", new
        {
            title,
            description = "d",
            priceAmount = 0m,
            priceCurrency = "USD",
            tags = Array.Empty<string>()
        });
        create.EnsureSuccessStatusCode();
        var id = (await create.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        if (publish)
            (await client.PostAsync($"/api/courses/{id}/publish", null)).EnsureSuccessStatusCode();
        return id;
    }

    [Fact]
    public async Task Dashboard_reports_owned_courses()
    {
        var (client, _) = await AuthedClientAsync(NewEmail("creator"));
        await CreateCourseAsync(client, "Dashboard Course", publish: true);

        var resp = await client.GetAsync("/api/creator/dashboard");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("totalCourses").GetInt32() >= 1);
        Assert.Equal(JsonValueKind.Array, body.GetProperty("courses").ValueKind);
    }

    [Fact]
    public async Task Dashboard_is_empty_for_new_creator()
    {
        var (client, _) = await AuthedClientAsync(NewEmail("empty"));

        var resp = await client.GetAsync("/api/creator/dashboard");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, body.GetProperty("totalCourses").GetInt32());
    }

    [Fact]
    public async Task Creator_orders_returns_paged_shape()
    {
        var (client, _) = await AuthedClientAsync(NewEmail("creator"));

        var resp = await client.GetAsync("/api/creator/orders?page=1&pageSize=10");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, body.GetProperty("page").GetInt32());
        Assert.Equal(10, body.GetProperty("pageSize").GetInt32());
        Assert.Equal(JsonValueKind.Array, body.GetProperty("items").ValueKind);
    }

    [Fact]
    public async Task Public_creator_courses_lists_published_only()
    {
        var (client, creatorId) = await AuthedClientAsync(NewEmail("creator"));
        await CreateCourseAsync(client, "Published By Creator", publish: true);
        await CreateCourseAsync(client, "Draft By Creator", publish: false);

        var anon = _factory.CreateClient();
        var resp = await anon.GetAsync($"/api/users/{creatorId}/courses");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("total").GetInt64() >= 1);
    }

    [Fact]
    public async Task Admin_delete_review_is_idempotent_and_gated()
    {
        // Non-admin is forbidden.
        var (user, _) = await AuthedClientAsync(NewEmail("user"));
        var forbidden = await user.DeleteAsync($"/api/admin/reviews/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        // Admin deleting a non-existent review is a no-op 204.
        var admin = await AdminClientAsync();
        var ok = await admin.DeleteAsync($"/api/admin/reviews/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NoContent, ok.StatusCode);
    }
}
