using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace IntegrationTests;

// Pins the /api/uploads (presign/confirm) and course media (thumbnail/intro-video)
// HTTP contract after the Uploads/Media context was converted to the layered shape.
[Collection("api")]
public class UploadsCharacterizationTests
{
    private readonly ApiFactory _factory;

    public UploadsCharacterizationTests(ApiFactory factory) => _factory = factory;

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

    private static async Task<Guid> CreateCourseAsync(HttpClient client, string title)
    {
        var resp = await client.PostAsJsonAsync("/api/courses", new
        {
            title,
            description = "d",
            priceAmount = 0m,
            priceCurrency = "USD",
            tags = Array.Empty<string>()
        });
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetGuid();
    }

    private static MultipartFormDataContent FileForm(byte[] bytes, string mime, string fileName)
    {
        var form = new MultipartFormDataContent();
        var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue(mime);
        form.Add(content, "file", fileName);
        return form;
    }

    [Fact]
    public async Task Presign_returns_proxy_mode_on_local_storage()
    {
        var client = await AuthedClientAsync(NewEmail("uploader"));

        var resp = await client.PostAsJsonAsync("/api/uploads/presign",
            new { fileName = "notes.pdf", contentType = "application/pdf" });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("proxy", body.GetProperty("mode").GetString());
    }

    [Fact]
    public async Task Presign_rejects_unsupported_mime()
    {
        var client = await AuthedClientAsync(NewEmail("uploader"));

        var resp = await client.PostAsJsonAsync("/api/uploads/presign",
            new { fileName = "evil.exe", contentType = "application/x-msdownload" });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Confirm_rejects_key_scoped_to_another_user()
    {
        var client = await AuthedClientAsync(NewEmail("uploader"));

        var resp = await client.PostAsJsonAsync("/api/uploads/confirm",
            new { key = "staged/deadbeefdeadbeefdeadbeefdeadbeef/foo.txt", fileName = "foo.txt", contentType = "text/plain" });

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Course_thumbnail_upload_and_serve()
    {
        var client = await AuthedClientAsync(NewEmail("creator"));
        var courseId = await CreateCourseAsync(client, "Thumb Course");

        using var form = FileForm(Encoding.UTF8.GetBytes("fake-png-bytes"), "image/png", "thumb.png");
        var upload = await client.PutAsync($"/api/courses/{courseId}/thumbnail", form);
        Assert.Equal(HttpStatusCode.OK, upload.StatusCode);
        var body = await upload.Content.ReadFromJsonAsync<JsonElement>();
        Assert.NotEqual(Guid.Empty, body.GetProperty("thumbnailFileId").GetGuid());

        var serve = await client.GetAsync($"/api/courses/{courseId}/thumbnail");
        Assert.Equal(HttpStatusCode.OK, serve.StatusCode);
    }

    [Fact]
    public async Task Thumbnail_upload_forbidden_for_non_owner()
    {
        var owner = await AuthedClientAsync(NewEmail("owner"));
        var courseId = await CreateCourseAsync(owner, "Owned Media Course");

        var stranger = await AuthedClientAsync(NewEmail("stranger"));
        using var form = FileForm(Encoding.UTF8.GetBytes("x"), "image/png", "thumb.png");
        var resp = await stranger.PutAsync($"/api/courses/{courseId}/thumbnail", form);
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Thumbnail_rejects_non_image()
    {
        var client = await AuthedClientAsync(NewEmail("creator"));
        var courseId = await CreateCourseAsync(client, "Bad Thumb Course");

        using var form = FileForm(Encoding.UTF8.GetBytes("not an image"), "text/plain", "thumb.txt");
        var resp = await client.PutAsync($"/api/courses/{courseId}/thumbnail", form);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Course_intro_video_upload_and_serve()
    {
        var client = await AuthedClientAsync(NewEmail("creator"));
        var courseId = await CreateCourseAsync(client, "Video Course");

        using var form = FileForm(Encoding.UTF8.GetBytes("fake-mp4-bytes"), "video/mp4", "intro.mp4");
        var upload = await client.PutAsync($"/api/courses/{courseId}/intro-video", form);
        Assert.Equal(HttpStatusCode.OK, upload.StatusCode);
        var body = await upload.Content.ReadFromJsonAsync<JsonElement>();
        Assert.NotEqual(Guid.Empty, body.GetProperty("introVideoFileId").GetGuid());

        var serve = await client.GetAsync($"/api/courses/{courseId}/intro-video");
        Assert.Equal(HttpStatusCode.OK, serve.StatusCode);
    }
}
