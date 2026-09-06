using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Domain.Catalog;
using Infrastructure.Catalog;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests;

// Pins the /api/courses and /api/catalog HTTP contract before the Catalog context is
// converted to the layered shape. Must stay green after.
[Collection("api")]
public class CatalogCharacterizationTests
{
    private readonly ApiFactory _factory;

    public CatalogCharacterizationTests(ApiFactory factory) => _factory = factory;

    private static string NewEmail(string prefix) => $"{prefix}-{Guid.NewGuid():N}@test.local";

    private async Task<HttpClient> AuthedClientAsync(string email)
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/auth/register", new { email, password = "Password123!" });
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Add("X-CSRF", body.GetProperty("csrf").GetString());
        return client;
    }

    private async Task<Guid> SeedPublishedCourseAsync(string title, decimal price)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
        var course = Course.Create(title, "seeded", price, "USD", Guid.NewGuid());
        course.Publish();
        db.Courses.Add(course);
        await db.SaveChangesAsync();
        return course.Id;
    }

    [Fact]
    public async Task Create_get_and_publish_lifecycle()
    {
        var client = await AuthedClientAsync(NewEmail("creator"));

        var create = await client.PostAsJsonAsync("/api/courses", new
        {
            title = "Layered Refactor 101",
            description = "d",
            priceAmount = 12.50m,
            priceCurrency = "USD",
            tags = new[] { "dotnet" }
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetGuid();
        Assert.Equal("Draft", created.GetProperty("status").GetString());

        var get = await client.GetAsync($"/api/courses/{id}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);

        var publish = await client.PostAsync($"/api/courses/{id}/publish", null);
        Assert.Equal(HttpStatusCode.OK, publish.StatusCode);
        var published = await publish.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Published", published.GetProperty("status").GetString());

        // A different authenticated user can see the published course; anonymous cannot.
        var other = await AuthedClientAsync(NewEmail("other"));
        Assert.Equal(HttpStatusCode.OK, (await other.GetAsync($"/api/courses/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().GetAsync($"/api/courses/{id}")).StatusCode);
    }

    [Fact]
    public async Task Create_course_with_invalid_title_returns_bad_request()
    {
        var client = await AuthedClientAsync(NewEmail("creator"));

        var resp = await client.PostAsJsonAsync("/api/courses", new
        {
            title = "ab",
            description = (string?)null,
            priceAmount = 10m,
            priceCurrency = "USD",
            tags = Array.Empty<string>()
        });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task List_courses_requires_auth()
    {
        var resp = await _factory.CreateClient().GetAsync("/api/courses");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Search_finds_published_course_by_title_term()
    {
        var term = $"quantum{Guid.NewGuid():N}".Substring(0, 12);
        await SeedPublishedCourseAsync($"A course about {term} physics", 20m);
        var client = await AuthedClientAsync(NewEmail("searcher"));

        var resp = await client.GetAsync($"/api/courses/search?q={term}");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("total").GetInt64() >= 1);
    }

    [Fact]
    public async Task Search_without_q_or_tags_returns_bad_request()
    {
        var client = await AuthedClientAsync(NewEmail("searcher"));
        var resp = await client.GetAsync("/api/courses/search");
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Review_requires_a_paid_order_then_can_be_posted_and_listed()
    {
        var courseId = await SeedPublishedCourseAsync($"Reviewable {Guid.NewGuid():N}", 0m);
        var client = await AuthedClientAsync(NewEmail("reviewer"));

        // Without a purchase, posting a review is forbidden.
        var forbidden = await client.PostAsJsonAsync($"/api/courses/{courseId}/reviews", new { rating = 5, comment = "great" });
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        // Buy the (free) course, which marks the order paid immediately.
        var purchase = new HttpRequestMessage(HttpMethod.Post, "/api/orders")
        {
            Content = JsonContent.Create(new { courseId })
        };
        purchase.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.Created, (await client.SendAsync(purchase)).StatusCode);

        var review = await client.PostAsJsonAsync($"/api/courses/{courseId}/reviews", new { rating = 5, comment = "great" });
        Assert.Equal(HttpStatusCode.Created, review.StatusCode);

        var list = await client.GetAsync($"/api/courses/{courseId}/reviews");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var body = await list.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("total").GetInt64() >= 1);
    }

    [Fact]
    public async Task Featured_and_stats_are_public()
    {
        await SeedPublishedCourseAsync($"Featured {Guid.NewGuid():N}", 15m);
        var anon = _factory.CreateClient();

        var featured = await anon.GetAsync("/api/catalog/featured?count=6");
        Assert.Equal(HttpStatusCode.OK, featured.StatusCode);
        Assert.Equal(JsonValueKind.Array, (await featured.Content.ReadFromJsonAsync<JsonElement>()).ValueKind);

        var stats = await anon.GetAsync("/api/catalog/stats");
        Assert.Equal(HttpStatusCode.OK, stats.StatusCode);
        var body = await stats.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("publishedCourses").GetInt32() >= 1);
    }
}
