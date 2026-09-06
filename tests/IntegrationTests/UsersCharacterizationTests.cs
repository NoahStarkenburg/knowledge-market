using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace IntegrationTests;

// Pins the /api/users and /api/admin/users HTTP contract before the Users context is
// converted to the layered controller/service/repository shape. Must stay green after.
[Collection("api")]
public class UsersCharacterizationTests
{
    private const string AdminEmail = "admin@tests.local";
    private const string AdminPassword = "AdminTests12345!";

    private readonly ApiFactory _factory;

    public UsersCharacterizationTests(ApiFactory factory) => _factory = factory;

    private static string NewEmail(string prefix) => $"{prefix}-{Guid.NewGuid():N}@test.local";

    // Registers via /api/auth/register (sets the auth + CSRF cookies) and returns an
    // authenticated client with the X-CSRF header set, plus the new user's id.
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

    [Fact]
    public async Task Register_via_users_endpoint_creates_user()
    {
        var (client, _) = await AuthedClientAsync(NewEmail("actor"));
        var email = NewEmail("created");

        var resp = await client.PostAsJsonAsync("/api/users", new { email, password = "Password123!" });

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(email, body.GetProperty("email").GetString());
        Assert.False(body.GetProperty("isEmailVerified").GetBoolean());
    }

    [Fact]
    public async Task Register_duplicate_email_returns_conflict()
    {
        var (client, _) = await AuthedClientAsync(NewEmail("actor"));
        var email = NewEmail("dupe");

        var first = await client.PostAsJsonAsync("/api/users", new { email, password = "Password123!" });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await client.PostAsJsonAsync("/api/users", new { email, password = "Password123!" });
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task Register_invalid_email_returns_bad_request()
    {
        var (client, _) = await AuthedClientAsync(NewEmail("actor"));

        var resp = await client.PostAsJsonAsync("/api/users", new { email = "not-an-email", password = "Password123!" });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Me_returns_profile_for_authenticated_user()
    {
        var email = NewEmail("me");
        var (client, _) = await AuthedClientAsync(email);

        var resp = await client.GetAsync("/api/users/me");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(email, body.GetProperty("email").GetString());
    }

    [Fact]
    public async Task Me_requires_authentication()
    {
        var resp = await _factory.CreateClient().GetAsync("/api/users/me");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Update_profile_changes_display_name()
    {
        var (client, _) = await AuthedClientAsync(NewEmail("upd"));

        var resp = await client.PatchAsJsonAsync("/api/users/me", new { displayName = "Renamed Person" });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Renamed Person", body.GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task Get_user_by_id_requires_auth_then_returns_user()
    {
        var (client, userId) = await AuthedClientAsync(NewEmail("byid"));

        var anon = await _factory.CreateClient().GetAsync($"/api/users/{userId}");
        Assert.Equal(HttpStatusCode.Unauthorized, anon.StatusCode);

        var authed = await client.GetAsync($"/api/users/{userId}");
        Assert.Equal(HttpStatusCode.OK, authed.StatusCode);
        var body = await authed.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(userId, body.GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task Admin_list_users_enforces_admin_role()
    {
        var anon = await _factory.CreateClient().GetAsync("/api/admin/users");
        Assert.Equal(HttpStatusCode.Unauthorized, anon.StatusCode);

        var (normal, _) = await AuthedClientAsync(NewEmail("normal"));
        var forbidden = await normal.GetAsync("/api/admin/users");
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        var admin = await AdminClientAsync();
        var ok = await admin.GetAsync("/api/admin/users");
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var body = await ok.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("total").GetInt64() >= 1);
    }
}
