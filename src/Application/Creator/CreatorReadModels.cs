using Domain.Catalog;

namespace Application.Creator;

// Raw rows the repository returns for the dashboard aggregation.
public sealed record CreatorCourseRow(Guid Id, string Title, CourseStatus Status, Guid? ThumbnailFileId, DateTimeOffset CreatedAt, DateTimeOffset? PublishedAt);
public sealed record CreatorOrderStat(Guid CourseId, long Count, decimal Revenue, string Currency);
public sealed record CreatorReviewStat(Guid CourseId, long Count, double Avg);

// Response shapes returned to the controller (serialized as-is).
public sealed record CreatorDashboard(
    int TotalCourses,
    int PublishedCourses,
    int DraftCourses,
    long TotalEnrollments,
    decimal TotalRevenue,
    long TotalReviews,
    double? AverageRating,
    IReadOnlyList<CreatorCourseStats> Courses);

public sealed record CreatorCourseStats(
    Guid Id,
    string Title,
    string Status,
    Guid? ThumbnailFileId,
    DateTimeOffset? PublishedAt,
    long Enrollments,
    decimal Revenue,
    string Currency,
    long ReviewCount,
    double? AverageRating);

public sealed record CreatorOrderRow(
    Guid OrderId,
    Guid CourseId,
    string CourseTitle,
    decimal Amount,
    string Currency,
    DateTimeOffset? PaidAt);
