using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace IntegrationTests;

[Collection("api")]
public class EmailVerificationTests(ApiFactory factory)
{
    private static string NewEmail() => $"verify-{Guid.NewGuid():N}@test.local";

    private async Task<HttpClient> RegisteredClientAsync(string email)
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var resp = await client.PostAsJsonAsync("/api/auth/register", new { email, password = "Password123!" });
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Add("X-CSRF", body.GetProperty("csrf").GetString());
        return client;
    }

    // Clicks the link in the newest email sent to this address, as the user would.
    private async Task AssertEmailedLinkVerifiesAsync(HttpClient client, string email)
    {
        var link = new Uri(factory.Emails.LastLinkSentTo(email));

        var resp = await client.GetAsync(link.PathAndQuery);

        Assert.Equal(HttpStatusCode.Redirect, resp.StatusCode);
        Assert.EndsWith("/verify-email?success=true", resp.Headers.Location!.ToString());
    }

    [Fact]
    public async Task Sign_up_link_verifies_the_email()
    {
        var email = NewEmail();
        var client = await RegisteredClientAsync(email);

        await AssertEmailedLinkVerifiesAsync(client, email);

        var me = await client.GetFromJsonAsync<JsonElement>("/api/users/me");
        Assert.True(me.GetProperty("isEmailVerified").GetBoolean());
    }

    [Fact]
    public async Task Resent_link_verifies_the_email()
    {
        var email = NewEmail();
        var client = await RegisteredClientAsync(email);

        var resend = await client.PostAsync("/api/auth/resend-verification", null);
        resend.EnsureSuccessStatusCode();

        await AssertEmailedLinkVerifiesAsync(client, email);

        var me = await client.GetFromJsonAsync<JsonElement>("/api/users/me");
        Assert.True(me.GetProperty("isEmailVerified").GetBoolean());
    }

    [Fact]
    public async Task Link_for_an_account_created_through_the_users_endpoint_verifies_it()
    {
        var client = await RegisteredClientAsync(NewEmail());
        var email = NewEmail();

        var created = await client.PostAsJsonAsync("/api/users", new { email, password = "Password123!" });
        created.EnsureSuccessStatusCode();

        await AssertEmailedLinkVerifiesAsync(client, email);
    }
}
