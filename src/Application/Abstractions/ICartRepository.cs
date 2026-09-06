using Application.Cart;

namespace Application.Abstractions;

public interface ICartRepository
{
    // Loads the buyer's cart with its items, tracked, so AddItem/RemoveItem/Clear can mutate it.
    Task<Domain.Cart.Cart?> GetTrackedCartForBuyerAsync(Guid buyerId, CancellationToken ct);

    // Stages a brand-new cart for insert (first-time buyer). Persisted on SaveChangesAsync.
    void AddCart(Domain.Cart.Cart cart);

    // Cross-context read into Catalog: course facts for the given ids (the bulk GetCourseForPurchase).
    Task<IReadOnlyList<CartCourseInfo>> GetCartCoursesInfoAsync(IReadOnlyList<Guid> courseIds, CancellationToken ct);

    Task SaveChangesAsync(CancellationToken ct);
}
