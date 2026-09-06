namespace Contracts.Catalog
{
    public sealed record CourseDto(
        Guid Id,
        string Title,
        string? Description,
        decimal PriceAmount,
        string PriceCurrency,
        string Status,
        DateTimeOffset CreatedAt,
        DateTimeOffset? PublishedAt,
        Guid CreatedById,
        string[] Tags,
        Guid? ThumbnailFileId,
        Guid? IntroVideoFileId
    );
}
