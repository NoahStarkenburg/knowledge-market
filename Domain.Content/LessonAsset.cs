using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Content
{
    public sealed class LessonAsset
    {
        public Guid Id { get; private set; }
        public Guid LessonId { get; private set; }
        public Guid ContentFileId { get; private set; }
        public string Title { get; private set; } = null!;
        public int SortOrder { get; private set; }
        public DateTimeOffset CreatedAt { get; private set; }
        public DateTimeOffset? DeletedAt { get; private set; }

        public LessonAsset(Guid lessonId, Guid contentFileId, string title, int sortOrder)
        {
            Id = Guid.NewGuid();
            LessonId = lessonId;
            ContentFileId = contentFileId;
            Title = string.IsNullOrWhiteSpace(title) ? string.Empty : title.Trim();
            SortOrder = sortOrder;
            CreatedAt = DateTimeOffset.UtcNow;
        }

        public void Rename(string newTitle)
        {
            if (!string.IsNullOrWhiteSpace(newTitle))
                Title = newTitle;
        }

        public void Reorder(int newSortOrder)
        {
            SortOrder = newSortOrder;
        }

        public void DeleteLessonAsset() => DeletedAt = DateTimeOffset.UtcNow;
    }
}
