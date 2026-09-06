namespace Domain.Content
{
    public sealed class LessonAssetText
    {
        public Guid Id { get; private set; }
        public Guid LessonId { get; private set; }
        public Guid OwnerId { get; private set; }
        public string Title { get; private set; } = null!;
        public string Text { get; private set; } = string.Empty;
        public int SortOrder { get; private set; }
        public DateTimeOffset CreatedAt { get; private set; }
        public DateTimeOffset? DeletedAt { get; private set; }

        private LessonAssetText() { }

        public static LessonAssetText Create(Guid lessonId, Guid ownerId, string title, string text, int sortOrder)
        {
            if (string.IsNullOrWhiteSpace(title)) throw new ArgumentNullException(nameof(title));
            return new LessonAssetText
            {
                Id = Guid.NewGuid(),
                LessonId = lessonId,
                OwnerId = ownerId,
                Title = title,
                Text = text,
                SortOrder = sortOrder,
                CreatedAt = DateTimeOffset.UtcNow,
            };
        }

        public void Rename(string newTitle)
        {
            if (!string.IsNullOrWhiteSpace(newTitle))
                Title = newTitle.Trim();
        }

        public void UpdateText(string text)
        {
            Text = string.IsNullOrWhiteSpace(text) ? string.Empty : text;
        }

        public void ReOrder(int order)
        {
            SortOrder = order;
        }

        public void DeleteLessonTextAsset() => DeletedAt = DateTimeOffset.UtcNow;
    }
}
