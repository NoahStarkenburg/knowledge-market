using Amazon.S3;
using Amazon.S3.Model;
using Application.Abstractions;
using Shared.Abstractions;
using Infrastructure.Content;
using Microsoft.EntityFrameworkCore;

namespace Api.Storage
{
    public sealed class S3Storage : IStorage
    {
        private readonly IAmazonS3 _s3;
        private readonly IAmazonS3 _presignS3;
        private readonly ContentDbContext _db;
        private readonly string _bucket;
        private readonly bool _usePresigned;
        private readonly bool _presignUseHttp;

        public S3Storage(IAmazonS3 s3, ContentDbContext db, IConfiguration cfg)
        {
            _s3 = s3;
            _db = db;
            _bucket = cfg["Storage:S3:AssetBucket"] ?? "km-assets";

            // When false, media is streamed through the API instead of redirecting to a
            // presigned URL. Needed when the storage host isn't reachable from the browser
            // (e.g. MinIO at "minio:9000" inside Docker).
            _usePresigned = cfg.GetValue<bool?>("Storage:S3:UsePresignedUrls") ?? true;

            // The SDK defaults presigned URLs to HTTPS. Local MinIO serves plain HTTP, so
            // pin the protocol to the presign endpoint's scheme (real S3 stays HTTPS).
            var presignEndpoint = cfg["Storage:S3:PublicServiceUrl"];
            if (string.IsNullOrWhiteSpace(presignEndpoint)) presignEndpoint = cfg["Storage:S3:ServiceUrl"];
            _presignUseHttp = presignEndpoint?.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ?? false;

            // Presigned URLs are handed to the browser, so they must point at a host the
            // browser can actually reach. Inside Docker the S3 client targets "minio:9000",
            // which only resolves on the compose network — sign against the public endpoint.
            var publicUrl = cfg["Storage:S3:PublicServiceUrl"];
            if (string.IsNullOrWhiteSpace(publicUrl) || publicUrl == cfg["Storage:S3:ServiceUrl"])
            {
                _presignS3 = s3;
            }
            else
            {
                _presignS3 = new AmazonS3Client(
                    cfg["Storage:S3:AccessKey"],
                    cfg["Storage:S3:SecretKey"],
                    new AmazonS3Config
                    {
                        ServiceURL = publicUrl,
                        ForcePathStyle = true,
                        UseHttp = publicUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase),
                    });
            }
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
            var key = $"staged/{userId:n}/{id:n}/{safeName}";

            await _s3.PutObjectAsync(new PutObjectRequest
            {
                BucketName = _bucket,
                Key = key,
                InputStream = content,
                ContentType = mime,
                AutoCloseStream = false,
            }, ct);

            return key;
        }

        public Task<PresignedUpload?> TryCreateUploadUrlAsync(
            Guid userId,
            string fileName,
            string mime,
            CancellationToken ct)
        {
            var safeName = Path.GetFileName(fileName);
            var id = Guid.NewGuid();
            var key = $"staged/{userId:n}/{id:n}/{safeName}";

            // Sign against the browser-reachable endpoint (localhost:9000 for MinIO,
            // the real bucket host for AWS). ContentType is signed, so the client must
            // send a matching Content-Type header on the PUT.
            var req = new GetPreSignedUrlRequest
            {
                BucketName = _bucket,
                Key = key,
                Verb = HttpVerb.PUT,
                Expires = DateTime.UtcNow.AddMinutes(10),
                ContentType = mime,
                Protocol = _presignUseHttp ? Protocol.HTTP : Protocol.HTTPS,
            };

            var url = _presignS3.GetPreSignedURL(req);
            return Task.FromResult<PresignedUpload?>(new PresignedUpload(url, key));
        }

        public async Task<long?> TryGetObjectSizeAsync(string key, CancellationToken ct)
        {
            try
            {
                var meta = await _s3.GetObjectMetadataAsync(_bucket, key, ct);
                return meta.ContentLength;
            }
            catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return null;
            }
        }

        public async Task<Stream> OpenReadAsync(Guid contentFileId, CancellationToken ct)
        {
            var key = await _db.ContentFiles.AsNoTracking()
                .Where(f => f.Id == contentFileId)
                .Select(f => f.StorageKey)
                .FirstOrDefaultAsync(ct)
                ?? throw new FileNotFoundException("Content file not found.", contentFileId.ToString());

            var response = await _s3.GetObjectAsync(_bucket, key, ct);
            return response.ResponseStream;
        }

        public async Task<FileMeta> GetMetadataAsync(Guid contentFileId, CancellationToken ct)
        {
            var cf = await _db.ContentFiles.AsNoTracking()
                .Where(f => f.Id == contentFileId)
                .Select(f => new { f.MimeType, f.FileSize, f.FileTitle, f.CreatedAt })
                .FirstOrDefaultAsync(ct)
                ?? throw new FileNotFoundException("Content file not found.", contentFileId.ToString());

            return new FileMeta(
                Mime: string.IsNullOrWhiteSpace(cf.MimeType) ? "application/octet-stream" : cf.MimeType,
                Size: cf.FileSize,
                FileName: string.IsNullOrWhiteSpace(cf.FileTitle) ? "download.bin" : cf.FileTitle,
                LastModifiedUtc: cf.CreatedAt.ToUniversalTime()
            );
        }

        public Task<string?> TryGetSignedReadUrl(Guid contentFileId, SignedReadOptions options, CancellationToken ct)
        {
            if (!_usePresigned)
                return Task.FromResult<string?>(null);

            return _db.ContentFiles.AsNoTracking()
                .Where(f => f.Id == contentFileId)
                .Select(f => f.StorageKey)
                .FirstOrDefaultAsync(ct)
                .ContinueWith(t =>
                {
                    var key = t.Result;
                    if (key is null) return null;

                    var req = new GetPreSignedUrlRequest
                    {
                        BucketName = _bucket,
                        Key = key,
                        Expires = DateTime.UtcNow.Add(options.Expires),
                        Verb = HttpVerb.GET,
                    };

                    if (options.FileName is not null || options.Disposition is not null)
                    {
                        req.ResponseHeaderOverrides.ContentDisposition =
                            $"{options.Disposition ?? "attachment"}; filename=\"{options.FileName ?? Path.GetFileName(key)}\"";
                    }

                    if (options.ResponseContentType is not null)
                        req.ResponseHeaderOverrides.ContentType = options.ResponseContentType;

                    return (string?)_presignS3.GetPreSignedURL(req);
                }, ct, TaskContinuationOptions.OnlyOnRanToCompletion, TaskScheduler.Default);
        }

        public async Task DeleteAsync(Guid contentFileId, CancellationToken ct)
        {
            var file = await _db.ContentFiles
                .Where(f => f.Id == contentFileId)
                .Select(f => new { f.Id, f.StorageKey, f.UserId })
                .FirstOrDefaultAsync(ct)
                ?? throw new FileNotFoundException("Content file not found.", contentFileId.ToString());

            var isAttached = await _db.LessonAssets
                .AnyAsync(a => a.ContentFileId == contentFileId, ct);
            if (isAttached)
                throw new InvalidOperationException("File is attached to a lesson and cannot be deleted.");

            await _s3.DeleteObjectAsync(_bucket, file.StorageKey, ct);

            var row = await _db.ContentFiles.FindAsync([contentFileId], ct);
            if (row is not null)
            {
                _db.ContentFiles.Remove(row);
                await _db.SaveChangesAsync(ct);
            }
        }
    }
}
