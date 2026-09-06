namespace Domain.Contracts.Catalog;

public sealed record ReviewDto(
    Guid Id,
    Guid CourseId,
    Guid ReviewerId,
    int Rating,
    string? Comment,
    DateTimeOffset CreatedAt
);
