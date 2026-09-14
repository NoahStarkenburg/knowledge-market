using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Azure.Storage.Blobs;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Infrastructure.Content;
using Infrastructure.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Shared.Abstractions;

namespace IntegrationTests;

// Exercises the Azure Blob adapter against Azurite, Microsoft's storage emulator, so the SAS URLs
// are checked by a real implementation of the Blob API rather than by a mock. Uses the "api"
// collection only for its SQL Server, which maps file ids to blob names.
//
// Azurite signs with an account key. The user delegation path used in Azure cannot run here and is
// verified against a real storage account after deploy.
[Collection("api")]
public sealed class AzureBlobStorageTests(ApiFactory factory) : IAsyncLifetime
{
    // The emulator's built-in account and key. Published by Microsoft and identical in every
    // Azurite install, so it protects nothing.
    private const string AzuriteKey =
        "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";

    private readonly IContainer _azurite = new ContainerBuilder()
        .WithImage("mcr.microsoft.com/azure-storage/azurite:3.37.0")
        .WithCommand("azurite-blob", "--blobHost", "0.0.0.0", "--inMemoryPersistence", "--skipApiVersionCheck")
        .WithPortBinding(10000, true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilMessageIsLogged("Blob service .*listen"))
        .Build();

    private static readonly HttpClient Http = new();

    private BlobServiceClient _service = null!;
    private IConfiguration _cfg = null!;

    public async Task InitializeAsync()
    {
        await _azurite.StartAsync();

        var endpoint = $"http://{_azurite.Hostname}:{_azurite.GetMappedPublicPort(10000)}/devstoreaccount1";
        _service = new BlobServiceClient(
            $"DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey={AzuriteKey};BlobEndpoint={endpoint};");
        _cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Cors:FrontendOrigin"] = "http://localhost:8080",
        }).Build();

        await new AzureBlobEmulatorInitializer(_service, _cfg, NullLogger<AzureBlobEmulatorInitializer>.Instance)
            .StartAsync(CancellationToken.None);
    }

    public Task DisposeAsync() => _azurite.DisposeAsync().AsTask();

    [Fact]
    public async Task Direct_upload_then_signed_download_round_trip()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var storage = new AzureBlobStorage(_service, new AzureBlobSasSigner(_service, _cfg), db, _cfg);
        var userId = Guid.NewGuid();
        var bytes = Encoding.UTF8.GetBytes("%PDF-1.4 pretend pdf");

        // 1. The API mints an upload URL; the "browser" PUTs straight to storage with the
        //    headers the API said to send.
        var upload = await storage.TryCreateUploadUrlAsync(userId, "notes.pdf", "application/pdf", CancellationToken.None);
        Assert.NotNull(upload);
        Assert.StartsWith($"staged/{userId:n}/", upload.Key);
        var put = await Http.SendAsync(PutRequest(upload, bytes));
        Assert.Equal(HttpStatusCode.Created, put.StatusCode);

        // 2. Confirm reads the real size from storage, not from the client.
        Assert.Equal(bytes.Length, await storage.TryGetObjectSizeAsync(upload.Key, CancellationToken.None));

        // 3. A signed read URL serves the bytes with the disposition and type baked into it.
        var file = new ContentFile(userId, upload.Key, "notes.pdf", bytes.Length, "application/pdf");
        db.ContentFiles.Add(file);
        await db.SaveChangesAsync();

        var readUrl = await storage.TryGetSignedReadUrl(file.Id,
            new SignedReadOptions { Disposition = "inline", FileName = "notes.pdf" }, CancellationToken.None);
        Assert.NotNull(readUrl);

        var get = await Http.GetAsync(readUrl);
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        Assert.Equal(bytes, await get.Content.ReadAsByteArrayAsync());
        Assert.Equal("application/pdf", get.Content.Headers.ContentType?.MediaType);
        Assert.Equal("inline", get.Content.Headers.ContentDisposition?.DispositionType);

        // 4. Delete removes the blob and the row.
        await storage.DeleteAsync(file.Id, CancellationToken.None);
        Assert.Null(await storage.TryGetObjectSizeAsync(upload.Key, CancellationToken.None));
    }

    [Fact]
    public async Task Upload_url_cannot_read_or_overwrite()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var storage = new AzureBlobStorage(_service, new AzureBlobSasSigner(_service, _cfg), db, _cfg);

        var upload = await storage.TryCreateUploadUrlAsync(Guid.NewGuid(), "a.png", "image/png", CancellationToken.None);
        Assert.NotNull(upload);
        Assert.Equal(HttpStatusCode.Created, (await Http.SendAsync(PutRequest(upload, [1, 2, 3]))).StatusCode);

        // Create-only permission: a leaked upload URL cannot fetch the file...
        Assert.Equal(HttpStatusCode.Forbidden, (await Http.GetAsync(upload.Url)).StatusCode);
        // ...or replace it once it exists.
        var overwrite = await Http.SendAsync(PutRequest(upload, [9, 9, 9]));
        Assert.False(overwrite.IsSuccessStatusCode);
    }

    [Fact]
    public async Task Signed_read_serves_the_validated_type_not_the_uploaded_one()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var storage = new AzureBlobStorage(_service, new AzureBlobSasSigner(_service, _cfg), db, _cfg);
        var userId = Guid.NewGuid();

        var upload = await storage.TryCreateUploadUrlAsync(userId, "photo.png", "image/png", CancellationToken.None);
        Assert.NotNull(upload);

        // A hostile client ignores the headers it was given and uploads a web page instead.
        var put = new HttpRequestMessage(HttpMethod.Put, upload.Url)
        {
            Content = new StringContent("<script>alert(1)</script>", Encoding.UTF8, "text/html"),
        };
        put.Headers.TryAddWithoutValidation("x-ms-blob-type", "BlockBlob");
        Assert.Equal(HttpStatusCode.Created, (await Http.SendAsync(put)).StatusCode);

        // The API recorded the type it validated at confirm time.
        var file = new ContentFile(userId, upload.Key, "photo.png", 25, "image/png");
        db.ContentFiles.Add(file);
        await db.SaveChangesAsync();

        var readUrl = await storage.TryGetSignedReadUrl(file.Id, new SignedReadOptions { Disposition = "inline" }, CancellationToken.None);
        var get = await Http.GetAsync(readUrl);

        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        Assert.Equal("image/png", get.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Upload_without_blob_type_header_is_rejected()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var storage = new AzureBlobStorage(_service, new AzureBlobSasSigner(_service, _cfg), db, _cfg);

        var upload = await storage.TryCreateUploadUrlAsync(Guid.NewGuid(), "a.png", "image/png", CancellationToken.None);
        Assert.NotNull(upload);

        // Why the presign response carries headers: a plain PUT, as an S3 client would send, fails.
        var bare = new HttpRequestMessage(HttpMethod.Put, upload.Url) { Content = new ByteArrayContent([1]) };
        Assert.Equal(HttpStatusCode.BadRequest, (await Http.SendAsync(bare)).StatusCode);
    }

    [Fact]
    public async Task Lesson_body_saves_overwrites_and_reports_missing()
    {
        var content = new AzureBlobContentStorage(_service, _cfg);
        var courseId = Guid.NewGuid();
        var lessonId = Guid.NewGuid();

        var key = await content.SaveLessonBodyAsync(courseId, lessonId, "# First", CancellationToken.None);
        await content.SaveLessonBodyAsync(courseId, lessonId, "# Edited", CancellationToken.None);

        Assert.Equal("# Edited", await content.ReadLessonBodyAsync(key, CancellationToken.None));
        Assert.Null(await content.ReadLessonBodyAsync($"{Guid.NewGuid():n}/missing.md", CancellationToken.None));
    }

    private static HttpRequestMessage PutRequest(PresignedUpload upload, byte[] bytes)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, upload.Url) { Content = new ByteArrayContent(bytes) };
        foreach (var (name, value) in upload.Headers)
        {
            // HttpClient keeps Content-Type on the body, every other header on the request.
            if (name.Equals("Content-Type", StringComparison.OrdinalIgnoreCase))
                request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(value);
            else
                request.Headers.TryAddWithoutValidation(name, value);
        }
        return request;
    }
}
