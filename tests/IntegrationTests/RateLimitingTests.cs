using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace IntegrationTests;

// The shared factory turns rate limiting off so other tests can make as many requests as they
// like. These tests start their own host with it on, against the same database.
[Collection("api")]
public class RateLimitingTests(ApiFactory factory)
{
    private const int GlobalPermitPerMinute = 200;

    private static string NewEmail() => $"limits-{Guid.NewGuid():N}@test.local";

    private static async Task<HttpClient> SignedInClientAsync(WebApplicationFactory<Program> host)
    {
        var client = host.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/auth/register", new { email = NewEmail(), password = "Password123!" });
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Add("X-CSRF", body.GetProperty("csrf").GetString());
        return client;
    }

    [Fact]
    public async Task Signed_in_users_sharing_one_address_each_get_their_own_request_budget()
    {
        await using var limited = factory.WithWebHostBuilder(b => b.ConfigureAppConfiguration((_, c) =>
            c.AddInMemoryCollection(new Dictionary<string, string?> { ["RateLimiting:Enabled"] = "true" })));
        var first = await SignedInClientAsync(limited);
        var second = await SignedInClientAsync(limited);

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i <= GlobalPermitPerMinute; i++)
            statuses.Add((await first.GetAsync("/api/users/me")).StatusCode);

        Assert.All(statuses.Take(GlobalPermitPerMinute), s => Assert.Equal(HttpStatusCode.OK, s));
        Assert.Equal(HttpStatusCode.TooManyRequests, statuses[^1]);
        Assert.Equal(HttpStatusCode.OK, (await second.GetAsync("/api/users/me")).StatusCode);
    }
}
