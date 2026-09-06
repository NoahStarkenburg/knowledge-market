using System.Text;
using Application.Abstractions;
using Shared.Abstractions;

namespace Api.ContentStorage
{
    public sealed class LocalContentStorage : IContentStorage
    {
        private readonly string _root;

        public LocalContentStorage(IHostEnvironment env)
        {
            _root = Path.Combine(env.ContentRootPath, "content");
            Directory.CreateDirectory(_root);
        }

        public async Task<string> SaveLessonBodyAsync(Guid courseId, Guid lessonId, string body, CancellationToken ct)
        {
            var dir = Path.Combine(_root, courseId.ToString("N"));
            Directory.CreateDirectory(dir);
            var file = Path.Combine(dir, $"{lessonId:N}.md");
            await File.WriteAllTextAsync(file, body, Encoding.UTF8, ct);
            // Return a relative key so the stored path is portable across machines/environments.
            // Legacy rows with absolute paths are handled in ReadLessonBodyAsync.
            return $"{courseId:N}/{lessonId:N}.md";
        }

        public async Task<string?> ReadLessonBodyAsync(string storagePath, CancellationToken ct)
        {
            var fullPath = Resolve(storagePath);
            return File.Exists(fullPath) ? await File.ReadAllTextAsync(fullPath, ct) : null;
        }

        // Supports both the new relative keys ("courseId/lessonId.md")
        // and legacy absolute paths written before this fix.
        private string Resolve(string storagePath)
        {
            if (Path.IsPathRooted(storagePath))
                return storagePath;

            var rel = storagePath.Replace('/', Path.DirectorySeparatorChar);
            return Path.Combine(_root, rel);
        }
    }
}
