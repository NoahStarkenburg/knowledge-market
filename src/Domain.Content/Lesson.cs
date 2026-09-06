namespace Domain.Content
{
    public sealed class Lesson
    {
        public Guid Id { get; private set; }
        public Guid CourseId { get; private set; }
        public Guid OwnerId { get; private set; }
        public string Title { get; private set; } = null!;
        public bool IsFreePreview { get; private set; }
        public int SortOrder { get; private set; }
        public string? StoragePath { get; private set; }
        public DateTimeOffset CreatedAt { get; private set; }
        public DateTimeOffset? DeletedAt { get; private set; }

        private Lesson() { }

        public static Lesson Create(Guid courseId, Guid ownerId, string title, bool isFreePreview)
        {
            if (courseId == Guid.Empty) throw new ArgumentException("Course is required", nameof(courseId));
            if (ownerId == Guid.Empty) throw new ArgumentException("Owner is required", nameof(ownerId));
            if (string.IsNullOrWhiteSpace(title) || title.Length is < 3 or > 200)
                throw new ArgumentException("Lesson title is required and should be at most 200 characters long.", nameof(title));

            return new Lesson
            {
                Id = Guid.NewGuid(),
                CourseId = courseId,
                OwnerId = ownerId,
                Title = title.Trim(),
                IsFreePreview = isFreePreview,
                CreatedAt = DateTimeOffset.UtcNow
            };
        }

        public void SetStoragePath(string storagePath)
        {
            StoragePath = storagePath;
        }

        public void UpdateTitle(string title)
        {
            if (string.IsNullOrWhiteSpace(title) || title.Length is < 3 or > 200)
                throw new ArgumentException("Title must be between 3 and 200 characters.", nameof(title));
            Title = title.Trim();
        }

        public void SetFreePreview(bool isFreePreview) => IsFreePreview = isFreePreview;

        public void Reorder(int sortOrder) => SortOrder = sortOrder;

        public void DeleteLesson() => DeletedAt = DateTimeOffset.UtcNow;
    }
}
