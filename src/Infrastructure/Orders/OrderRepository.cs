using System.Linq.Expressions;
using Application.Abstractions;
using Application.Common;
using Application.Orders;
using Domain.Catalog;
using Domain.Contracts.Orders;
using Domain.Orders;
using Infrastructure.Catalog;
using Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;

namespace Infrastructure.Orders;

// Order/subscription data access, including the create transactions with idempotency
// rows and the cross-context reads into Catalog (course) and Identity (buyer).
public sealed class OrderRepository(
    OrdersDbContext orders,
    CatalogDbContext catalog,
    UsersDbContext users) : IOrderRepository
{
    private static readonly Expression<Func<Order, OrderDto>> ToDtoProjection = o => new OrderDto(
        o.Id, o.BuyerId, o.CourseId, o.CourseTitleSnapshot, o.Price.Amount, o.Price.Currency,
        o.Status.ToString(), o.CreatedAt, o.PaidAt);

    private static OrderDto ToDto(Order o) => new(
        o.Id, o.BuyerId, o.CourseId, o.CourseTitleSnapshot, o.Price.Amount, o.Price.Currency,
        o.Status.ToString(), o.CreatedAt, o.PaidAt);

    private static SubscriptionDto ToSubDto(Subscription s) => new(
        s.Id, s.BuyerId, s.CoursesOwnerId, s.Status.ToString(), s.CurrentPeriodStart, s.CurrentPeriodEnd);

    // 2627 = unique constraint, 2601 = unique index. Both mean "someone already inserted
    // this", which is how the idempotency and duplicate-purchase paths detect a replay.
    private static bool IsUnique(DbUpdateException ex) =>
        ex.InnerException is SqlException sql && sql.Number is 2627 or 2601;

    // ---- Orders ----

    public Task<Guid?> FindOrderIdByKeyAsync(Guid buyerId, string key, CancellationToken ct) =>
        orders.IdempotencyKeys.AsNoTracking()
            .Where(k => k.BuyerId == buyerId && k.Key == key)
            .Select(k => (Guid?)k.OrderId)
            .FirstOrDefaultAsync(ct);

    public Task<OrderDto?> GetDtoByIdAsync(Guid id, CancellationToken ct) =>
        orders.Orders.AsNoTracking().Where(o => o.Id == id).Select(ToDtoProjection).FirstOrDefaultAsync(ct);

    public Task<OrderDto?> GetDtoForBuyerAsync(Guid id, Guid buyerId, CancellationToken ct) =>
        orders.Orders.AsNoTracking().Where(o => o.Id == id && o.BuyerId == buyerId).Select(ToDtoProjection).FirstOrDefaultAsync(ct);

    public Task<OrderDto?> FindExistingForCourseAsync(Guid buyerId, Guid courseId, CancellationToken ct) =>
        orders.Orders.AsNoTracking().Where(o => o.BuyerId == buyerId && o.CourseId == courseId).Select(ToDtoProjection).FirstOrDefaultAsync(ct);

    public Task<Order?> GetTrackedForBuyerAsync(Guid id, Guid buyerId, CancellationToken ct) =>
        orders.Orders.FirstOrDefaultAsync(o => o.Id == id && o.BuyerId == buyerId, ct);

    public Task<CoursePurchaseInfo?> GetCourseForPurchaseAsync(Guid courseId, CancellationToken ct) =>
        catalog.Courses.AsNoTracking()
            .Where(c => c.Id == courseId)
            .Select(c => new CoursePurchaseInfo(c.Title.Value, c.Price.Amount, c.Price.Currency, c.Status == CourseStatus.Published, c.CreatedById))
            .FirstOrDefaultAsync(ct);

    public async Task<OrderDto> CreateWithIdempotencyAsync(Order order, string key, CancellationToken ct)
    {
        await using var tx = await orders.Database.BeginTransactionAsync(ct);
        orders.Orders.Add(order);
        try
        {
            await orders.SaveChangesAsync(ct);
            orders.IdempotencyKeys.Add(new IdempotencyKey
            {
                Id = Guid.NewGuid(),
                BuyerId = order.BuyerId,
                Key = key,
                OrderId = order.Id,
                CreatedAt = DateTimeOffset.UtcNow
            });
            await orders.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return ToDto(order);
        }
        catch (DbUpdateException ex) when (IsUnique(ex))
        {
            await tx.RollbackAsync(ct);

            var byKeyId = await FindOrderIdByKeyAsync(order.BuyerId, key, ct);
            if (byKeyId is Guid id)
            {
                var dto = await GetDtoByIdAsync(id, ct);
                if (dto is not null) return dto;
            }

            var byCourse = await FindExistingForCourseAsync(order.BuyerId, order.CourseId, ct);
            if (byCourse is not null) return byCourse;

            throw new ConflictException("Order already processed with this Idempotency-Key.");
        }
    }

    public async Task<PagedResult<OrderDto>> ListAsync(Guid buyerId, string? status, string? q, DateTimeOffset? from, DateTimeOffset? to, int page, int pageSize, CancellationToken ct)
    {
        var query = orders.Orders.AsNoTracking().Where(o => o.BuyerId == buyerId);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<Orderstatus>(status, true, out var st))
            query = query.Where(o => o.Status == st);
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(o => EF.Functions.Like(o.CourseTitleSnapshot, $"%{q.Trim()}%"));
        if (from is not null)
            query = query.Where(o => o.CreatedAt >= from.Value);
        if (to is not null)
            query = query.Where(o => o.CreatedAt <= to.Value);

        var total = await query.LongCountAsync(ct);
        var items = await query.OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(ToDtoProjection).ToListAsync(ct);

        return new PagedResult<OrderDto>(page, pageSize, total, items);
    }

    public Task<bool> IsEnrolledAsync(Guid buyerId, Guid courseId, CancellationToken ct) =>
        orders.Orders.AsNoTracking().AnyAsync(o => o.BuyerId == buyerId && o.CourseId == courseId && o.Status == Orderstatus.Paid, ct);

    public async Task<PagedResult<OrderDto>> AdminListAsync(string? status, string? q, DateTimeOffset? from, DateTimeOffset? to, int page, int pageSize, CancellationToken ct)
    {
        var query = orders.Orders.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<Orderstatus>(status, true, out var st))
            query = query.Where(o => o.Status == st);
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(o => EF.Functions.Like(o.CourseTitleSnapshot, $"%{q.Trim()}%"));
        if (from is not null)
            query = query.Where(o => o.CreatedAt >= from.Value);
        if (to is not null)
            query = query.Where(o => o.CreatedAt <= to.Value);

        var total = await query.LongCountAsync(ct);
        var items = await query.OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(ToDtoProjection).ToListAsync(ct);

        return new PagedResult<OrderDto>(page, pageSize, total, items);
    }

    public Task SaveChangesAsync(CancellationToken ct) => orders.SaveChangesAsync(ct);

    // ---- Subscriptions ----

    public Task<Guid?> FindSubscriptionIdByKeyAsync(Guid buyerId, string key, CancellationToken ct) =>
        orders.IdempotencyKeys.AsNoTracking()
            .Where(k => k.BuyerId == buyerId && k.Key == key)
            .Select(k => (Guid?)k.OrderId)
            .FirstOrDefaultAsync(ct);

    public Task<SubscriptionDto?> GetSubscriptionDtoAsync(Guid id, CancellationToken ct) =>
        orders.Subscriptions.AsNoTracking()
            .Where(s => s.Id == id)
            .Select(s => new SubscriptionDto(s.Id, s.BuyerId, s.CoursesOwnerId, s.Status.ToString(), s.CurrentPeriodStart, s.CurrentPeriodEnd))
            .FirstOrDefaultAsync(ct);

    public Task<BuyerInfo?> GetBuyerAsync(Guid buyerId, CancellationToken ct) =>
        users.Users.AsNoTracking()
            .Where(u => u.Id == buyerId)
            .Select(u => new BuyerInfo(u.Email.Value, u.StripeCustomerId))
            .FirstOrDefaultAsync(ct);

    public async Task SetBuyerStripeCustomerAsync(Guid buyerId, string customerId, CancellationToken ct)
    {
        var user = await users.Users.FirstOrDefaultAsync(u => u.Id == buyerId, ct);
        if (user is null) return;
        user.SetStripeCustomerId(customerId);
        await users.SaveChangesAsync(ct);
    }

    public async Task<(bool Created, Guid SubId)> TryCreateSubscriptionAsync(Subscription subscription, string key, CancellationToken ct)
    {
        await using var tx = await orders.Database.BeginTransactionAsync(ct);
        orders.Subscriptions.Add(subscription);
        try
        {
            await orders.SaveChangesAsync(ct);
            orders.IdempotencyKeys.Add(new IdempotencyKey
            {
                Id = Guid.NewGuid(),
                BuyerId = subscription.BuyerId,
                Key = key,
                OrderId = subscription.Id,
                CreatedAt = DateTimeOffset.UtcNow
            });
            await orders.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return (true, subscription.Id);
        }
        catch (DbUpdateException ex) when (IsUnique(ex))
        {
            await tx.RollbackAsync(ct);
            var existing = await FindSubscriptionIdByKeyAsync(subscription.BuyerId, key, ct);
            if (existing is Guid id) return (false, id);
            throw new ConflictException("Subscription already processed with this Idempotency-Key.");
        }
    }

    public async Task SetSubscriptionStripeIdAsync(Guid subscriptionId, string stripeSubId, CancellationToken ct)
    {
        var sub = await orders.Subscriptions.FirstOrDefaultAsync(s => s.Id == subscriptionId, ct);
        if (sub is null) return;
        sub.SetStripeSubscriptionId(stripeSubId);
        await orders.SaveChangesAsync(ct);
    }

    public async Task DeleteSubscriptionAsync(Guid subscriptionId, CancellationToken ct) =>
        await orders.Subscriptions.Where(s => s.Id == subscriptionId).ExecuteDeleteAsync(ct);

    public async Task<IReadOnlyList<SubscriptionDto>> ListSubscriptionsAsync(Guid buyerId, CancellationToken ct) =>
        await orders.Subscriptions.AsNoTracking()
            .Where(s => s.BuyerId == buyerId)
            .OrderByDescending(s => s.CurrentPeriodStart)
            .Select(s => new SubscriptionDto(s.Id, s.BuyerId, s.CoursesOwnerId, s.Status.ToString(), s.CurrentPeriodStart, s.CurrentPeriodEnd))
            .ToListAsync(ct);

    public Task<Subscription?> GetTrackedSubscriptionForBuyerAsync(Guid id, Guid buyerId, CancellationToken ct) =>
        orders.Subscriptions.FirstOrDefaultAsync(s => s.Id == id && s.BuyerId == buyerId, ct);

    // ---- Webhook lookups ----

    public Task<Order?> GetTrackedOrderByPaymentIntentAsync(string paymentIntentId, CancellationToken ct) =>
        orders.Orders.FirstOrDefaultAsync(o => o.StripePaymentIntentId == paymentIntentId, ct);

    public Task<string?> GetBuyerEmailAsync(Guid buyerId, CancellationToken ct) =>
        users.Users.AsNoTracking().Where(u => u.Id == buyerId).Select(u => u.Email.Value).FirstOrDefaultAsync(ct)!;

    public Task<Subscription?> GetTrackedSubscriptionByStripeIdAsync(string stripeSubscriptionId, CancellationToken ct) =>
        orders.Subscriptions.FirstOrDefaultAsync(s => s.StripeSubscriptionId == stripeSubscriptionId, ct);
}
