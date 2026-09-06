using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Domain.Catalog;
using Infrastructure.Catalog;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests;

// Pins the /api/orders HTTP contract (purchase, detail, list, enrollment, checkout, refund,
// subscriptions) before the Orders context is converted. Must stay green after.
[Collection("api")]
public class OrdersCharacterizationTests
{
    private readonly ApiFactory _factory;

    public OrdersCharacterizationTests(ApiFactory factory) => _factory = factory;

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

    private async Task<Guid> SeedPublishedCourseAsync(decimal price)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
        var course = Course.Create($"Order Course {Guid.NewGuid():N}", "seeded", price, "USD", Guid.NewGuid());
        course.Publish();
        db.Courses.Add(course);
        await db.SaveChangesAsync();
        return course.Id;
    }

    private static async Task<HttpResponseMessage> PurchaseAsync(HttpClient client, Guid courseId)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/orders")
        {
            Content = JsonContent.Create(new { courseId })
        };
        req.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());
        return await client.SendAsync(req);
    }

    [Fact]
    public async Task Purchase_paid_course_creates_pending_order()
    {
        var courseId = await SeedPublishedCourseAsync(19.99m);
        var client = await AuthedClientAsync(NewEmail("buyer"));

        var resp = await PurchaseAsync(client, courseId);

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Pending", body.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Purchase_unpublished_course_is_rejected()
    {
        Guid draftId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
            var course = Course.Create($"Draft {Guid.NewGuid():N}", "d", 5m, "USD", Guid.NewGuid());
            db.Courses.Add(course);
            await db.SaveChangesAsync();
            draftId = course.Id;
        }
        var client = await AuthedClientAsync(NewEmail("buyer"));

        var resp = await PurchaseAsync(client, draftId);

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Order_detail_is_visible_to_owner_only()
    {
        var courseId = await SeedPublishedCourseAsync(0m);
        var buyer = await AuthedClientAsync(NewEmail("buyer"));
        var created = await (await PurchaseAsync(buyer, courseId)).Content.ReadFromJsonAsync<JsonElement>();
        var orderId = created.GetProperty("id").GetGuid();

        Assert.Equal(HttpStatusCode.OK, (await buyer.GetAsync($"/api/orders/{orderId}")).StatusCode);

        var stranger = await AuthedClientAsync(NewEmail("stranger"));
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/orders/{orderId}")).StatusCode);
    }

    [Fact]
    public async Task List_orders_returns_the_buyers_orders()
    {
        var courseId = await SeedPublishedCourseAsync(0m);
        var client = await AuthedClientAsync(NewEmail("buyer"));
        await PurchaseAsync(client, courseId);

        var resp = await client.GetAsync("/api/orders");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("total").GetInt64() >= 1);
    }

    [Fact]
    public async Task Enrollment_check_reflects_paid_purchase()
    {
        var courseId = await SeedPublishedCourseAsync(0m);
        var client = await AuthedClientAsync(NewEmail("buyer"));

        var before = await client.GetAsync($"/api/orders/check?courseId={courseId}");
        Assert.False((await before.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("enrolled").GetBoolean());

        await PurchaseAsync(client, courseId); // free -> immediately paid

        var after = await client.GetAsync($"/api/orders/check?courseId={courseId}");
        Assert.True((await after.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("enrolled").GetBoolean());
    }

    [Fact]
    public async Task Checkout_returns_client_secret_for_paid_order_and_rejects_free()
    {
        var paidCourse = await SeedPublishedCourseAsync(29.99m);
        var client = await AuthedClientAsync(NewEmail("buyer"));
        var order = await (await PurchaseAsync(client, paidCourse)).Content.ReadFromJsonAsync<JsonElement>();
        var orderId = order.GetProperty("id").GetGuid();

        var checkout = await client.PostAsync($"/api/orders/{orderId}/checkout", null);
        Assert.Equal(HttpStatusCode.OK, checkout.StatusCode);
        var body = await checkout.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("clientSecret").GetString()));

        // A free order cannot be checked out.
        var freeCourse = await SeedPublishedCourseAsync(0m);
        var freeOrder = await (await PurchaseAsync(client, freeCourse)).Content.ReadFromJsonAsync<JsonElement>();
        var freeCheckout = await client.PostAsync($"/api/orders/{freeOrder.GetProperty("id").GetGuid()}/checkout", null);
        Assert.Equal(HttpStatusCode.BadRequest, freeCheckout.StatusCode);
    }

    [Fact]
    public async Task Refund_paid_order_within_window_then_rejects_unpaid()
    {
        var freeCourse = await SeedPublishedCourseAsync(0m);
        var client = await AuthedClientAsync(NewEmail("buyer"));
        var order = await (await PurchaseAsync(client, freeCourse)).Content.ReadFromJsonAsync<JsonElement>();
        var orderId = order.GetProperty("id").GetGuid();

        var refund = await client.PostAsync($"/api/orders/{orderId}/refund", null);
        Assert.Equal(HttpStatusCode.OK, refund.StatusCode);
        Assert.Equal("Refunded", (await refund.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("status").GetString());

        // A pending (unpaid) order cannot be refunded.
        var paidCourse = await SeedPublishedCourseAsync(15m);
        var pending = await (await PurchaseAsync(client, paidCourse)).Content.ReadFromJsonAsync<JsonElement>();
        var pendingRefund = await client.PostAsync($"/api/orders/{pending.GetProperty("id").GetGuid()}/refund", null);
        Assert.Equal(HttpStatusCode.BadRequest, pendingRefund.StatusCode);
    }

    [Fact]
    public async Task Subscribe_list_and_cancel_subscription()
    {
        var courseId = await SeedPublishedCourseAsync(25m);
        var client = await AuthedClientAsync(NewEmail("subscriber"));

        var subReq = new HttpRequestMessage(HttpMethod.Post, "/api/orders/subscribe")
        {
            Content = JsonContent.Create(new { courseId })
        };
        subReq.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());
        var sub = await client.SendAsync(subReq);
        Assert.Equal(HttpStatusCode.Created, sub.StatusCode);

        var list = await client.GetAsync("/api/orders/subscriptions");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var items = (await list.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("items");
        Assert.True(items.GetArrayLength() >= 1);
        var subId = items[0].GetProperty("id").GetGuid();

        var cancel = await client.DeleteAsync($"/api/orders/subscriptions/{subId}");
        Assert.Equal(HttpStatusCode.NoContent, cancel.StatusCode);
    }
}
