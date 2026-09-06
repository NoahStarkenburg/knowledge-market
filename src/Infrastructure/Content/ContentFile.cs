using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Infrastructure.Content
{
    public sealed class ContentFile
    {
        public Guid Id { get; private set; }
        public Guid UserId { get; private set; }
        public string StorageKey { get; private set; } = null!;
        public string FileTitle { get; private set; } = null!;
        public long FileSize { get; private set; }
        public string MimeType { get; private set; } = null!;
        public DateTimeOffset CreatedAt { get; private set; }

        public ContentFile(Guid userId, string storageKey, string fileTitle, long fileSize, string mimeType)
        {
            Id = Guid.NewGuid();
            UserId = userId;
            StorageKey = string.IsNullOrWhiteSpace(storageKey) ? string.Empty : storageKey.Trim();
            FileTitle = string.IsNullOrWhiteSpace(fileTitle) ? string.Empty : fileTitle.Trim();
            FileSize = fileSize < 0 ? 0 : fileSize;
            MimeType = string.IsNullOrWhiteSpace(mimeType) ? string.Empty : mimeType.Trim();
            CreatedAt = DateTimeOffset.UtcNow;
        }

        

    }
}
