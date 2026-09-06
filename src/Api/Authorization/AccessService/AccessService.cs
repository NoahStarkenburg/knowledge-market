using Api.Auth.Handlers;
using Api.Auth.Resources;
using Domain.Orders;
using Infrastructure.Catalog;
using Infrastructure.Orders;
using Microsoft.EntityFrameworkCore;

namespace Api.Auth.AccessService;

public sealed class AccessService(
    OrdersDbContext ordersDb,
    CatalogDbContext catalogDb
) : IAccessService
{
    public async Task<bool> CanViewCourse(Guid userId, CourseShell course, CancellationToken ct)
    {
        // Published courses are viewable publicly (course page, landing page, etc.)
        if (course.isPublished) return true;

        // Unpublished course: only owner can view (admin handled in handler)
        if (userId == Guid.Empty) return false;
        if (course.ownerId == userId) return true;

        // If you want buyers/subscribers to view an unpublished course, decide that explicitly.
        // Most marketplaces do NOT allow this (unpublished = hidden).
        return false;
    }

    public async Task<bool> CanViewLesson(Guid userId, LessonShell lesson, CancellationToken ct)
    {
        // Free preview lessons are public, even if user isn't logged in.
        if (lesson.isFreePreview) return true;

        // Past this point, you must be logged in.
        if (userId == Guid.Empty) return false;

        // Owner always has access.
        if (lesson.ownerId == userId) return true;


        // Otherwise must have entitlement (paid or subscription)
        return await HasPaidAccess(userId, lesson.courseId, lesson.ownerId, ct);
    }

    // Helper: checks purchase or subscription entitlement
    private async Task<bool> HasPaidAccess(Guid userId, Guid courseId, Guid ownerId, CancellationToken ct)
    {
        var course = await catalogDb.Courses.AsNoTracking()
        .Where(c => c.Id == courseId)
        .Select(c => new { c.CreatedById, c.PublishedAt })
        .SingleOrDefaultAsync(ct);

        if (course is null) return false;

        // If not published, deny non-owners
        if (course.PublishedAt is null) return false;

        // Owner check can optionally be here too (extra safety)
        if (course.CreatedById == userId) return true;

        // One-time purchase
        var hasPaidOrder = await ordersDb.Orders.AsNoTracking()
            .AnyAsync(o => o.CourseId == courseId &&
                           o.BuyerId == userId &&
                           o.Status == Orderstatus.Paid, ct);

        if (hasPaidOrder) return true;

        // Subscription entitlement
        var now = DateTimeOffset.UtcNow;

        var hasActiveSubscription = await ordersDb.Subscriptions.AsNoTracking()
            .AnyAsync(s => s.BuyerId == userId &&
                           s.CoursesOwnerId == ownerId &&
                           s.Status == SubscriptionStatus.Active &&
                           s.CurrentPeriodStart <= now &&
                           s.CurrentPeriodEnd > now, ct);

        return hasActiveSubscription;
    }

}
