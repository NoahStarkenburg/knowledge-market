using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Amazon.S3;
using Amazon.S3.Model;

namespace Infrastructure.Storage
{
    public sealed class S3BucketInitializer : IHostedService
    {
        private readonly IAmazonS3 _s3;
        private readonly IConfiguration _cfg;
        private readonly ILogger<S3BucketInitializer> _logger;

        public S3BucketInitializer(IAmazonS3 s3, IConfiguration cfg, ILogger<S3BucketInitializer> logger)
        {
            _s3 = s3;
            _cfg = cfg;
            _logger = logger;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            var assetBucket = _cfg["Storage:S3:AssetBucket"] ?? "km-assets";
            var contentBucket = _cfg["Storage:S3:ContentBucket"] ?? "km-content";

            await EnsureBucketExistsAsync(assetBucket, cancellationToken);
            await EnsureBucketExistsAsync(contentBucket, cancellationToken);

            // Real AWS S3 needs an explicit CORS rule so the browser can PUT directly to
            // a presigned URL. MinIO (a custom ServiceUrl) allows cross-origin by default.
            if (string.IsNullOrWhiteSpace(_cfg["Storage:S3:ServiceUrl"]))
                await EnsureUploadCorsAsync(assetBucket, cancellationToken);
        }

        public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

        private async Task EnsureUploadCorsAsync(string bucketName, CancellationToken ct)
        {
            var origin = _cfg["Cors:FrontendOrigin"] ?? "http://localhost:4200";
            try
            {
                await _s3.PutCORSConfigurationAsync(new PutCORSConfigurationRequest
                {
                    BucketName = bucketName,
                    Configuration = new CORSConfiguration
                    {
                        Rules =
                        [
                            new CORSRule
                            {
                                Id = "km-presigned-upload",
                                AllowedMethods = ["PUT"],
                                AllowedOrigins = [origin],
                                AllowedHeaders = ["*"],
                                MaxAgeSeconds = 3000,
                            }
                        ]
                    }
                }, ct);
                _logger.LogInformation("Configured upload CORS on bucket: {Bucket}", bucketName);
            }
            catch (Exception ex)
            {
                // Non-fatal: direct uploads simply fall back to the proxied path.
                _logger.LogWarning(ex, "Could not set CORS on bucket {Bucket}", bucketName);
            }
        }

        private async Task EnsureBucketExistsAsync(string bucketName, CancellationToken ct)
        {
            try
            {
                var listResponse = await _s3.ListBucketsAsync(ct);
                var exists = listResponse.Buckets.Any(b => b.BucketName == bucketName);

                if (!exists)
                {
                    await _s3.PutBucketAsync(new PutBucketRequest
                    {
                        BucketName = bucketName,
                        UseClientRegion = true,
                    }, ct);
                    _logger.LogInformation("Created S3 bucket: {Bucket}", bucketName);
                }
                else
                {
                    _logger.LogInformation("S3 bucket already exists: {Bucket}", bucketName);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to ensure S3 bucket exists: {Bucket}", bucketName);
                throw;
            }
        }
    }
}
