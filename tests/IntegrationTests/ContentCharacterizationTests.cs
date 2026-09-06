using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace IntegrationTests;

// Pins the lesson / lesson-asset / lesson-text HTTP contract after the Content context was
// converted to the layered controller/service/repository shape.
[Collection("api")]
public class ContentCharacterizationTests
{
    private readonly ApiFactory _factory;

    public ContentCharacterizationTests(ApiFactory factory) => _factory = factory;

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

    private static async Task<Guid> CreateLessonAsync(HttpClient client, Guid courseId, string title, bool freePreview = false)
    {
        var resp = await client.PostAsJsonAsync($"/api/courses/{courseId}/lessons",
            new { title, isFreePreview = freePreview, body = "# hello\nbody text" });
        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetGuid();
    }

    [Fact]
    public async Task Lesson_lifecycle_create_list_get_content()
    {
        var client = await AuthedClientAsync(NewEmail("creator"));
        var courseId = await CreateCourseAsync(client, "Content Course");
        var lessonId = await CreateLessonAsync(client, courseId, "Intro Lesson", freePreview: true);

        var list = await client.GetAsync($"/api/courses/{courseId}/lessons");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var listBody = await list.Content.ReadFromJsonAsync<JsonElement>();
        var items = listBody.GetProperty("items").EnumerateArray().ToList();
        Assert.Contains(items, i => i.GetProperty("id").GetGuid() == lessonId);

        var meta = await client.GetAsync($"/api/courses/{courseId}/lessons/{lessonId}");
        Assert.Equal(HttpStatusCode.OK, meta.StatusCode);
        var metaBody = await meta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Intro Lesson", metaBody.GetProperty("title").GetString());

        var content = await client.GetAsync($"/api/courses/{courseId}/lessons/{lessonId}/content");
        Assert.Equal(HttpStatusCode.OK, content.StatusCode);
        var contentBody = await content.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(lessonId, contentBody.GetProperty("lessonId").GetGuid());
        Assert.Equal(JsonValueKind.Array, contentBody.GetProperty("items").ValueKind);
    }

    [Fact]
    public async Task Create_lesson_forbidden_for_non_owner()
    {
        var owner = await AuthedClientAsync(NewEmail("owner"));
        var courseId = await CreateCourseAsync(owner, "Owned Course");

        var stranger = await AuthedClientAsync(NewEmail("stranger"));
        var resp = await stranger.PostAsJsonAsync($"/api/courses/{courseId}/lessons",
            new { title = "Sneaky Lesson", isFreePreview = false, body = "x" });
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Create_lesson_invalid_title_returns_bad_request()
    {
        var client = await AuthedClientAsync(NewEmail("creator"));
        var courseId = await CreateCourseAsync(client, "Course For Bad Lesson");

        var resp = await client.PostAsJsonAsync($"/api/courses/{courseId}/lessons",
            new { title = "ab", isFreePreview = false, body = "x" });
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Lessons_require_auth()
    {
        var owner = await AuthedClientAsync(NewEmail("owner"));
        var courseId = await CreateCourseAsync(owner, "Auth Gate Course");

        var anon = _factory.CreateClient();
        var resp = await anon.GetAsync($"/api/courses/{courseId}/lessons");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Lesson_text_crud_roundtrip()
    {
        var client = await AuthedClientAsync(NewEmail("creator"));
        var courseId = await CreateCourseAsync(client, "Text Course");
        var lessonId = await CreateLessonAsync(client, courseId, "Text Lesson");

        var create = await client.PostAsJsonAsync(
            $"/api/courses/{courseId}/lessons/{lessonId}/texts",
            new { title = "Block A", bodyMarkdown = "**bold**" });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<JsonElement>();
        var textId = created.GetProperty("id").GetGuid();
        Assert.Equal("**bold**", created.GetProperty("bodyMarkdown").GetString());

        var list = await client.GetAsync($"/api/courses/{courseId}/lessons/{lessonId}/texts");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var listBody = await list.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(listBody.GetProperty("items").EnumerateArray(), i => i.GetProperty("id").GetGuid() == textId);

        var update = await client.PatchAsJsonAsync(
            $"/api/courses/{courseId}/lessons/{lessonId}/texts/{textId}",
            new { title = "Block A2", bodyMarkdown = (string?)null });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var updated = await update.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Block A2", updated.GetProperty("title").GetString());

        var delete = await client.DeleteAsync($"/api/courses/{courseId}/lessons/{lessonId}/texts/{textId}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
    }

    [Fact]
    public async Task Upload_attach_list_and_download_asset()
    {
        var client = await AuthedClientAsync(NewEmail("creator"));
        var courseId = await CreateCourseAsync(client, "Asset Course");
        var lessonId = await CreateLessonAsync(client, courseId, "Asset Lesson", freePreview: true);

        // Upload a staged file.
        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes("hello file"));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        form.Add(fileContent, "file", "notes.txt");

        var upload = await client.PostAsync($"/api/courses/{courseId}/lessons/upload", form);
        Assert.Equal(HttpStatusCode.Created, upload.StatusCode);
        var uploaded = await upload.Content.ReadFromJsonAsync<JsonElement>();
        var fileId = uploaded.GetProperty("id").GetGuid();

        // Attach it to the lesson.
        var attach = await client.PostAsJsonAsync(
            $"/api/courses/{courseId}/lessons/{lessonId}/assets",
            new { contentFileId = fileId, title = "Notes", sortOrder = 0 });
        Assert.Equal(HttpStatusCode.Created, attach.StatusCode);

        var list = await client.GetAsync($"/api/courses/{courseId}/lessons/{lessonId}/assets");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var listBody = await list.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(listBody.GetProperty("items").EnumerateArray(), i => i.GetProperty("fileTitle").GetString() == "notes.txt");

        // Download it back (local storage streams through the API).
        var download = await client.GetAsync($"/api/courses/{courseId}/lessons/{lessonId}/files/{fileId}/download");
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal("hello file", await download.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Lesson_progress_mark_and_unmark()
    {
        var client = await AuthedClientAsync(NewEmail("creator"));
        var courseId = await CreateCourseAsync(client, "Progress Course");
        var lessonId = await CreateLessonAsync(client, courseId, "Trackable Lesson");

        var mark = await client.PostAsync($"/api/courses/{courseId}/lessons/{lessonId}/complete", null);
        Assert.Equal(HttpStatusCode.NoContent, mark.StatusCode);

        var progress = await client.GetAsync($"/api/courses/{courseId}/lessons/progress");
        Assert.Equal(HttpStatusCode.OK, progress.StatusCode);
        var body = await progress.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(body.GetProperty("completedLessonIds").EnumerateArray(), i => i.GetGuid() == lessonId);

        var unmark = await client.DeleteAsync($"/api/courses/{courseId}/lessons/{lessonId}/complete");
        Assert.Equal(HttpStatusCode.NoContent, unmark.StatusCode);
    }

    [Fact]
    public async Task Reorder_lessons_succeeds_for_owner()
    {
        var client = await AuthedClientAsync(NewEmail("creator"));
        var courseId = await CreateCourseAsync(client, "Reorder Course");
        var first = await CreateLessonAsync(client, courseId, "First");
        var second = await CreateLessonAsync(client, courseId, "Second");

        var reorder = await client.PatchAsJsonAsync($"/api/courses/{courseId}/lessons/reorder", new
        {
            items = new[]
            {
                new { kind = "lesson", id = second, newSort = 0 },
                new { kind = "lesson", id = first, newSort = 1 },
            }
        });
        Assert.Equal(HttpStatusCode.NoContent, reorder.StatusCode);
    }

    [Fact]
    public async Task Reorder_lessons_rejects_foreign_lesson_id()
    {
        var client = await AuthedClientAsync(NewEmail("creator"));
        var courseId = await CreateCourseAsync(client, "Reorder Guard Course");
        await CreateLessonAsync(client, courseId, "Only Lesson");

        var reorder = await client.PatchAsJsonAsync($"/api/courses/{courseId}/lessons/reorder", new
        {
            items = new[] { new { kind = "lesson", id = Guid.NewGuid(), newSort = 0 } }
        });
        Assert.Equal(HttpStatusCode.BadRequest, reorder.StatusCode);
    }

    [Fact]
    public async Task Delete_lesson_is_idempotent()
    {
        var client = await AuthedClientAsync(NewEmail("creator"));
        var courseId = await CreateCourseAsync(client, "Deletable Course");
        var lessonId = await CreateLessonAsync(client, courseId, "Doomed Lesson");

        var first = await client.DeleteAsync($"/api/courses/{courseId}/lessons/{lessonId}");
        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);

        var second = await client.DeleteAsync($"/api/courses/{courseId}/lessons/{lessonId}");
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
    }
}
