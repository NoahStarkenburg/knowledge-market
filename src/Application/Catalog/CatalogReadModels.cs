using Domain.Contracts.Catalog;

namespace Application.Catalog;

// A course read plus the fields the web layer needs for the draft-visibility check.
public sealed record CourseView(CourseDto Dto, bool IsPublished, Guid CreatedById);

// Lightweight owner/status shell used for resource-based authorization.
public sealed record CourseShellData(Guid Id, Guid OwnerId, bool IsPublished);

public sealed record CatalogStats(int PublishedCourses, int Creators);

public sealed record CourseStats(long EnrollmentCount, decimal TotalRevenue, long ReviewCount, double? AvgRating);

public sealed record ReviewsPage(int Page, int PageSize, long Total, double? AvgRating, IReadOnlyList<ReviewDto> Items);

// Result of an upsert: Created=true means a new review (201), false means an update (200).
public sealed record ReviewResult(ReviewDto Review, bool Created);
