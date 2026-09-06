using Infrastructure.Catalog;
using Infrastructure.Content;
using Infrastructure.Identity;
using Infrastructure.Orders;
using Microsoft.EntityFrameworkCore;

namespace Api.DataSeeding;

public static class BulkSeedEndpoints
{
    public static IEndpointRouteBuilder MapBulkSeed(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/dev")
            .WithTags("Dev")
            .AllowAnonymous();

        // ── POST /api/dev/bulk-seed ───────────────────────────────────
        group.MapPost("/bulk-seed", async (
            BulkDataSeeder seeder,
            CancellationToken ct) =>
        {
            if (await seeder.IsAlreadySeededAsync(ct))
                return Results.Ok(new { ok = true, message = "Already seeded." });

            var result = await seeder.SeedAsync(ct);

            return Results.Ok(new
            {
                ok = true,
                message = "Bulk seed complete.",
                password = BulkSeedConstants.DefaultPassword,
                emailDomain = BulkSeedConstants.EmailDomain,
                counts = new
                {
                    result.Users,
                    result.Courses,
                    result.Lessons,
                    result.LessonMarkdownWrites,
                    result.LessonAssetTexts,
                    result.ContentFiles,
                    result.LessonAssets,
                    result.Orders,
                    result.Reviews,
                    result.LessonProgress,
                    result.Subscriptions,
                    result.Total,
                },
            });
        })
        .WithName("BulkSeed")
        .Produces(StatusCodes.Status200OK);

        // ── DELETE /api/dev/bulk-reset ─────────────────────────────────
        group.MapDelete("/bulk-reset", async (
            UsersDbContext usersDb,
            CatalogDbContext catalogDb,
            OrdersDbContext ordersDb,
            ContentDbContext contentDb,
            CancellationToken ct) =>
        {
            // Find seed user IDs by email suffix
            var seedUserIds = await usersDb.Users
                .Where(u => u.Email.Value.EndsWith(BulkSeedConstants.EmailDomain))
                .Select(u => u.Id)
                .ToListAsync(ct);

            if (seedUserIds.Count == 0)
                return Results.Ok(new { ok = true, message = "Nothing to reset." });

            // Find seed course IDs
            var seedCourseIds = await catalogDb.Courses
                .IgnoreQueryFilters()
                .Where(c => seedUserIds.Contains(c.CreatedById))
                .Select(c => c.Id)
                .ToListAsync(ct);

            // Find all lesson IDs for seed courses
            var seedLessonIds = await contentDb.Lessons
                .IgnoreQueryFilters()
                .Where(l => seedCourseIds.Contains(l.CourseId))
                .Select(l => l.Id)
                .ToListAsync(ct);

            // Delete in reverse FK order

            // Progress
            await contentDb.LessonProgress
                .Where(p => seedUserIds.Contains(p.UserId))
                .ExecuteDeleteAsync(ct);

            // LessonAssetTexts (process in chunks to avoid parameter limit)
            foreach (var chunk in seedLessonIds.Chunk(500))
            {
                await contentDb.LessonAssetTexts
                    .IgnoreQueryFilters()
                    .Where(t => chunk.Contains(t.LessonId))
                    .ExecuteDeleteAsync(ct);
            }

            // LessonAssets
            foreach (var chunk in seedLessonIds.Chunk(500))
            {
                await contentDb.LessonAssets
                    .IgnoreQueryFilters()
                    .Where(a => chunk.Contains(a.LessonId))
                    .ExecuteDeleteAsync(ct);
            }

            // ContentFiles (owned by seed users)
            foreach (var chunk in seedUserIds.Chunk(500))
            {
                await contentDb.ContentFiles
                    .Where(f => chunk.Contains(f.UserId))
                    .ExecuteDeleteAsync(ct);
            }

            // Lessons
            foreach (var chunk in seedCourseIds.Chunk(500))
            {
                await contentDb.Lessons
                    .IgnoreQueryFilters()
                    .Where(l => chunk.Contains(l.CourseId))
                    .ExecuteDeleteAsync(ct);
            }

            // Reviews
            foreach (var chunk in seedCourseIds.Chunk(500))
            {
                await catalogDb.CourseReviews
                    .Where(r => chunk.Contains(r.CourseId))
                    .ExecuteDeleteAsync(ct);
            }

            // Courses
            foreach (var chunk in seedCourseIds.Chunk(500))
            {
                await catalogDb.Courses
                    .IgnoreQueryFilters()
                    .Where(c => chunk.Contains(c.Id))
                    .ExecuteDeleteAsync(ct);
            }

            // Orders
            foreach (var chunk in seedUserIds.Chunk(500))
            {
                await ordersDb.Orders
                    .Where(o => chunk.Contains(o.BuyerId))
                    .ExecuteDeleteAsync(ct);
            }

            // Subscriptions
            foreach (var chunk in seedUserIds.Chunk(500))
            {
                await ordersDb.Subscriptions
                    .Where(s => chunk.Contains(s.BuyerId))
                    .ExecuteDeleteAsync(ct);
            }

            // RefreshTokens
            foreach (var chunk in seedUserIds.Chunk(500))
            {
                await usersDb.RefreshTokens
                    .Where(t => chunk.Contains(t.UserId))
                    .ExecuteDeleteAsync(ct);
            }

            // Users
            foreach (var chunk in seedUserIds.Chunk(500))
            {
                await usersDb.Users
                    .Where(u => chunk.Contains(u.Id))
                    .ExecuteDeleteAsync(ct);
            }

            return Results.Ok(new
            {
                ok = true,
                message = "Bulk seed data deleted.",
                deletedUserCount = seedUserIds.Count,
                deletedCourseCount = seedCourseIds.Count,
            });
        })
        .WithName("BulkReset")
        .Produces(StatusCodes.Status200OK);

        return app;
    }
}
