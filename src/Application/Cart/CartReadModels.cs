namespace Application.Cart;

// Course fields the cart reads from the Catalog context to build each CartItemDto and to
// enforce the "must be published" rule. Looked up in bulk, so it carries CourseId to match
// each result back to its cart item.
public sealed record CartCourseInfo(Guid CourseId, string Title, decimal PriceAmount, string PriceCurrency, bool IsPublished, Guid? ThumbnailFileId);

public sealed record CartCheckoutResult(IReadOnlyList<Guid> OrderIds);
