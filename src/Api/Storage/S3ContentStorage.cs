using Amazon.S3;
using Amazon.S3.Model;
using Application.Abstractions;
using System.Text;

namespace Api.Storage
{
    public sealed class S3ContentStorage : IContentStorage
    {
        private readonly IAmazonS3 _s3;
        private readonly string _bucket;

        public S3ContentStorage(IAmazonS3 s3, IConfiguration cfg)
        {
            _s3 = s3;
            _bucket = cfg["Storage:S3:ContentBucket"] ?? "km-content";
        }

        public async Task<string> SaveLessonBodyAsync(Guid courseId, Guid lessonId, string body, CancellationToken ct)
        {
            var key = $"content/{courseId:n}/{lessonId:n}.md";

            await _s3.PutObjectAsync(new PutObjectRequest
            {
                BucketName = _bucket,
                Key = key,
                ContentBody = body,
                ContentType = "text/markdown; charset=utf-8",
            }, ct);

            return key;
        }

        public async Task<string?> ReadLessonBodyAsync(string storagePath, CancellationToken ct)
        {
            try
            {
                var response = await _s3.GetObjectAsync(_bucket, storagePath, ct);
                using var reader = new StreamReader(response.ResponseStream, Encoding.UTF8);
                return await reader.ReadToEndAsync(ct);
            }
            catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return null;
            }
        }
    }
}
