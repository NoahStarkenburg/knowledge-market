namespace Domain.Catalog;

public sealed class CourseReview
{
    public Guid Id { get; private set; }
    public Guid CourseId { get; private set; }
    public Guid ReviewerId { get; private set; }
    public int Rating { get; private set; }        // 1–5
    public string? Comment { get; private set; }   // optional, max 1000 chars
    public DateTimeOffset CreatedAt { get; private set; }

    private CourseReview() { }

    public static CourseReview Create(Guid courseId, Guid reviewerId, int rating, string? comment)
    {
        if (rating is < 1 or > 5)
            throw new ArgumentOutOfRangeException(nameof(rating), "Rating must be between 1 and 5.");

        return new CourseReview
        {
            Id = Guid.NewGuid(),
            CourseId = courseId,
            ReviewerId = reviewerId,
            Rating = rating,
            Comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        };
    }

    public void Update(int? rating, string? comment)
    {
        if (rating.HasValue)
        {
            if (rating.Value is < 1 or > 5)
                throw new ArgumentOutOfRangeException(nameof(rating), "Rating must be between 1 and 5.");
            Rating = rating.Value;
        }
        if (comment is not null)
            Comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
    }
}
