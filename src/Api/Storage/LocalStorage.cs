using Application.Abstractions;
using Infrastructure.Content;
using Microsoft.EntityFrameworkCore;

namespace Api.Storage
{
    public sealed class LocalStorage : IStorage
    {
        private readonly ContentDbContext db;
        private readonly string root;

        public LocalStorage(ContentDbContext db, IConfiguration cfg)
        {
            this.db = db;
            root = cfg["Storage:Root"] is { Length: > 0 } r
                ? Path.GetFullPath(r)
                : Path.Combine(AppContext.BaseDirectory, "storage");
            Directory.CreateDirectory(root);
        }

        public async Task<string> SaveAsync(
    Guid userId,
    string fileName,
    string mime,
    Stream content,
    CancellationToken ct)
        {
            var safeName = Path.GetFileName(fileName);
            var id = Guid.NewGuid();

            var key = Path.Combine(
                "staged",
                userId.ToString("n"),
                id.ToString("n"),
                safeName
            ).Replace('\\', '/');

            var fullPath = Path.Combine(root, key);
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

            await using var fs = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, bufferSize: 1024 * 128, useAsync: true);
            await content.CopyToAsync(fs, ct);
            await fs.FlushAsync();

            return key; // THIS is what ContentFile stores
        }


        public async Task<Stream> OpenReadAsync(Guid id, CancellationToken ct)
        {
            var key = await db.ContentFiles.AsNoTracking()
                .Where(f => f.Id == id)
                .Select(f => f.StorageKey)
                .FirstOrDefaultAsync(ct) ?? throw new FileNotFoundException();

            var full = FullPath(key);
            return new FileStream(full, new FileStreamOptions
            {
                Mode = FileMode.Open, Access = FileAccess.Read, Share = FileShare.Read,
                Options = FileOptions.Asynchronous |FileOptions.SequentialScan
            });
        }

        public async Task<FileMeta> GetMetadataAsync(Guid id, CancellationToken ct)
        {
            var cf = await db.ContentFiles.AsNoTracking()
                .Where(f => f.Id == id)
                .Select(f => new { f.MimeType, f.FileSize, f.FileTitle, f.CreatedAt })
                .FirstOrDefaultAsync(ct) ?? throw new FileNotFoundException();

            return new FileMeta(
                Mime: string.IsNullOrWhiteSpace(cf.MimeType) ? "application/octet-stream" : cf.MimeType,
                Size: cf.FileSize,
                FileName: string.IsNullOrWhiteSpace(cf.FileTitle) ? "download.bin" : cf.FileTitle,
                LastModifiedUtc: cf.CreatedAt.ToUniversalTime()
            );
        }

        public Task<string?> TryGetSignedReadUrl(Guid _, SignedReadOptions __, CancellationToken ___)
            => Task.FromResult<string?>(null);

        // Local disk can't hand the browser a direct upload URL, so callers fall back
        // to the proxied multipart upload.
        public Task<PresignedUpload?> TryCreateUploadUrlAsync(Guid _, string __, string ___, CancellationToken ____)
            => Task.FromResult<PresignedUpload?>(null);

        public Task<long?> TryGetObjectSizeAsync(string _, CancellationToken __)
            => Task.FromResult<long?>(null);

        public async Task DeleteAsync(Guid contentFileId, CancellationToken ct)
        {
            var file = await db.ContentFiles
                .Where(f => f.Id == contentFileId)
                .Select(f => new { f.Id, f.StorageKey, f.UserId })
                .FirstOrDefaultAsync(ct)
                ?? throw new FileNotFoundException("Content file not found.", contentFileId.ToString());

            var isAttached = await db.LessonAssets
                .AnyAsync(a => a.ContentFileId == contentFileId, ct);
            if (isAttached)
                throw new InvalidOperationException("File is attached to a lesson and cannot be deleted.");

            var fullPath = FullPath(file.StorageKey);
            if (File.Exists(fullPath))
                File.Delete(fullPath);

            // Best-effort: delete the empty parent dir (guid dir)
            var parent = Path.GetDirectoryName(fullPath);
            if (parent is not null && Directory.Exists(parent) && !Directory.EnumerateFileSystemEntries(parent).Any())
                Directory.Delete(parent);

            var row = await db.ContentFiles.FindAsync([contentFileId], ct);
            if (row is not null)
            {
                db.ContentFiles.Remove(row);
                await db.SaveChangesAsync(ct);
            }
        }

        private string FullPath(string key)
        {
            var rel = key.Replace('/', Path.DirectorySeparatorChar);
            var full = Path.GetFullPath(Path.Combine(root, rel));
            if (!full.StartsWith(root, StringComparison.Ordinal)) throw new UnauthorizedAccessException("Traversal");
            return full;
        }

    }
}
