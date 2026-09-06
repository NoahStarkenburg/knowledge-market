// FILE: src/Api/Endpoints/DevSeedEndpoints.cs
// Dev-only endpoints for seeding and resetting demo data.
// Registered only when IsDevelopment() is true.

using Domain.Catalog;
using Domain.Content;
using Domain.Identity;
using Domain.Orders;
using Infrastructure.Catalog;
using Infrastructure.Content;
using Infrastructure.Identity;
using Infrastructure.Orders;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints;

public static class DevSeedEndpoints
{
    private const string SeedTag = "seed";

    public static IEndpointRouteBuilder MapDevSeed(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/dev")
            .WithTags("Dev")
            .AllowAnonymous();

        // ── POST /api/dev/seed ──────────────────────────────────────────────
        group.MapPost("/seed", async (
            UsersDbContext usersDb,
            CatalogDbContext catalogDb,
            OrdersDbContext ordersDb,
            ContentDbContext contentDb,
            IConfiguration cfg,
            CancellationToken ct) =>
        {
            // Idempotency guard: skip if seed data already exists
            var alreadySeeded = await usersDb.Users
                .AnyAsync(u => u.Email.Value == SeedUsers.Creator1Email, ct);

            if (alreadySeeded)
                return Results.Ok(new { ok = true, message = "Already seeded." });

            // ── 1. Users ───────────────────────────────────────────────────
            var creator1 = User.Register(SeedUsers.Creator1Email, SeedUsers.DefaultPassword);
            creator1.VerifyEmail(creator1.VerificationToken!);

            var creator2 = User.Register(SeedUsers.Creator2Email, SeedUsers.DefaultPassword);
            creator2.VerifyEmail(creator2.VerificationToken!);

            var buyer1 = User.Register(SeedUsers.Buyer1Email, SeedUsers.DefaultPassword);
            buyer1.VerifyEmail(buyer1.VerificationToken!);

            var buyer2 = User.Register(SeedUsers.Buyer2Email, SeedUsers.DefaultPassword);
            buyer2.VerifyEmail(buyer2.VerificationToken!);

            usersDb.Users.AddRange(creator1, creator2, buyer1, buyer2);
            await usersDb.SaveChangesAsync(ct);

            // ── 2. Courses ─────────────────────────────────────────────────
            var course1 = Course.Create(
                "Complete TypeScript Mastery",
                "Learn TypeScript from the ground up. Covers generics, decorators, and advanced type system features.",
                49_99m, "usd", creator1.Id);
            course1.SetTags(new[] { "typescript", "javascript", "programming" });
            course1.Publish();

            var course2 = Course.Create(
                "React 19 for Production",
                "Build production-grade React applications. RSC, streaming, Suspense and more.",
                39_99m, "usd", creator1.Id);
            course2.SetTags(new[] { "react", "javascript", "frontend" });
            course2.Publish();

            var course3 = Course.Create(
                "PostgreSQL Performance Tuning",
                "Deep dive into query planning, indexing strategies, and Postgres internals.",
                59_99m, "usd", creator2.Id);
            course3.SetTags(new[] { "postgresql", "database", "performance" });
            course3.Publish();

            var course4Free = Course.Create(
                "Git Fundamentals",
                "Free crash course covering git basics, branching, merging and rebasing.",
                0m, "usd", creator2.Id);
            course4Free.SetTags(new[] { "git", "devops" });
            course4Free.Publish();

            catalogDb.Courses.AddRange(course1, course2, course3, course4Free);
            await catalogDb.SaveChangesAsync(ct);

            // ── 3. Lessons ─────────────────────────────────────────────────
            var lessons1 = CreateLessons(course1.Id, creator1.Id, new[]
            {
                ("Introduction to TypeScript", true),
                ("Types & Interfaces", false),
                ("Generics in Depth", false),
                ("Decorators & Metadata", false),
                ("Building a Real Project", false),
            });

            var lessons2 = CreateLessons(course2.Id, creator1.Id, new[]
            {
                ("React 19 Overview", true),
                ("Server Components", false),
                ("Streaming with Suspense", false),
                ("State Management in 2025", false),
            });

            var lessons3 = CreateLessons(course3.Id, creator2.Id, new[]
            {
                ("How Postgres Plans Queries", true),
                ("Index Types & Strategy", false),
                ("VACUUM & Autovacuum", false),
                ("Connection Pooling", false),
            });

            var lessons4 = CreateLessons(course4Free.Id, creator2.Id, new[]
            {
                ("What is Git?", true),
                ("Branching & Merging", true),
                ("Resolving Conflicts", false),
            });

            contentDb.Lessons.AddRange(lessons1);
            contentDb.Lessons.AddRange(lessons2);
            contentDb.Lessons.AddRange(lessons3);
            contentDb.Lessons.AddRange(lessons4);
            await contentDb.SaveChangesAsync(ct);

            // ── 4. Lesson text content ─────────────────────────────────────
            var texts = new List<LessonAssetText>();
            foreach (var lesson in lessons1)
                texts.Add(LessonAssetText.Create(lesson.Id, creator1.Id,
                    "Reading", $"## {lesson.Title}\n\nThis is the lesson content for **{lesson.Title}**. " +
                    "In a real course, this would contain comprehensive notes, code examples, " +
                    "and key takeaways.\n\n```typescript\nconst hello: string = 'Hello, TypeScript!';\nconsole.log(hello);\n```", 0));

            foreach (var lesson in lessons3)
                texts.Add(LessonAssetText.Create(lesson.Id, creator2.Id,
                    "Reading", $"## {lesson.Title}\n\nThis lesson covers **{lesson.Title}** " +
                    "in depth. Here's a sample query:\n\n```sql\nEXPLAIN ANALYZE\nSELECT * FROM users WHERE email = 'test@example.com';\n```", 0));

            contentDb.LessonAssetTexts.AddRange(texts);
            await contentDb.SaveChangesAsync(ct);

            // ── 5. Orders (paid) ───────────────────────────────────────────
            // buyer1 bought course1 and course3
            var order1 = Domain.Orders.Order.Create(buyer1.Id, course1.Id, course1.Title.Value, course1.Price.Amount, course1.Price.Currency);
            order1.MarkPaid();

            var order2 = Domain.Orders.Order.Create(buyer1.Id, course3.Id, course3.Title.Value, course3.Price.Amount, course3.Price.Currency);
            order2.MarkPaid();

            // buyer2 bought course2 and free course4
            var order3 = Domain.Orders.Order.Create(buyer2.Id, course2.Id, course2.Title.Value, course2.Price.Amount, course2.Price.Currency);
            order3.MarkPaid();

            var order4 = Domain.Orders.Order.Create(buyer2.Id, course4Free.Id, course4Free.Title.Value, course4Free.Price.Amount, course4Free.Price.Currency);
            order4.MarkPaid(); // free courses are auto-paid

            ordersDb.Orders.AddRange(order1, order2, order3, order4);
            await ordersDb.SaveChangesAsync(ct);

            // ── 6. Reviews ─────────────────────────────────────────────────
            var reviews = new List<CourseReview>
            {
                CourseReview.Create(course1.Id, buyer1.Id, 5, "Absolutely brilliant course. The generics section alone is worth it."),
                CourseReview.Create(course1.Id, buyer2.Id, 4, "Very thorough. Could use more real-world examples but overall excellent."),
                CourseReview.Create(course2.Id, buyer2.Id, 5, "Best React course out there. Finally a course that keeps up with 2025."),
                CourseReview.Create(course3.Id, buyer1.Id, 5, "Transformed how I think about database performance. Highly recommended."),
            };

            catalogDb.CourseReviews.AddRange(reviews);
            await catalogDb.SaveChangesAsync(ct);

            // ── 7. Lesson progress (buyer1 completed first 2 lessons of course1) ──
            var progressRecords = new List<LessonProgress>
            {
                LessonProgress.Create(buyer1.Id, lessons1[0].Id, course1.Id),
                LessonProgress.Create(buyer1.Id, lessons1[1].Id, course1.Id),
                LessonProgress.Create(buyer2.Id, lessons2[0].Id, course2.Id),
            };

            contentDb.LessonProgress.AddRange(progressRecords);
            await contentDb.SaveChangesAsync(ct);

            return Results.Ok(new
            {
                ok = true,
                message = "Seed complete.",
                users = new
                {
                    creator1 = new { email = SeedUsers.Creator1Email, password = SeedUsers.DefaultPassword },
                    creator2 = new { email = SeedUsers.Creator2Email, password = SeedUsers.DefaultPassword },
                    buyer1   = new { email = SeedUsers.Buyer1Email,   password = SeedUsers.DefaultPassword },
                    buyer2   = new { email = SeedUsers.Buyer2Email,   password = SeedUsers.DefaultPassword },
                },
                courses = new[]
                {
                    new { id = course1.Id, title = course1.Title.Value },
                    new { id = course2.Id, title = course2.Title.Value },
                    new { id = course3.Id, title = course3.Title.Value },
                    new { id = course4Free.Id, title = course4Free.Title.Value },
                },
            });
        })
        .WithName("DevSeed")
        .Produces(StatusCodes.Status200OK);

        // ── DELETE /api/dev/reset ───────────────────────────────────────────
        group.MapDelete("/reset", async (
            UsersDbContext usersDb,
            CatalogDbContext catalogDb,
            OrdersDbContext ordersDb,
            ContentDbContext contentDb,
            CancellationToken ct) =>
        {
            var seedEmails = new[] { SeedUsers.Creator1Email, SeedUsers.Creator2Email, SeedUsers.Buyer1Email, SeedUsers.Buyer2Email };

            // Get seed user IDs
            var seedUserIds = await usersDb.Users
                .Where(u => seedEmails.Contains(u.Email.Value))
                .Select(u => u.Id)
                .ToListAsync(ct);

            if (!seedUserIds.Any())
                return Results.Ok(new { ok = true, message = "Nothing to reset." });

            // Get seed course IDs
            var seedCourseIds = await catalogDb.Courses
                .Where(c => seedUserIds.Contains(c.CreatedById))
                .Select(c => c.Id)
                .ToListAsync(ct);

            // Delete in reverse dependency order

            // Content
            await contentDb.LessonProgress
                .Where(p => seedUserIds.Contains(p.UserId))
                .ExecuteDeleteAsync(ct);

            foreach (var cid in seedCourseIds)
            {
                var lessonIds = await contentDb.Lessons
                    .IgnoreQueryFilters()
                    .Where(l => l.CourseId == cid)
                    .Select(l => l.Id)
                    .ToListAsync(ct);

                if (lessonIds.Count > 0)
                {
                    await contentDb.LessonAssetTexts
                        .IgnoreQueryFilters()
                        .Where(t => lessonIds.Contains(t.LessonId))
                        .ExecuteDeleteAsync(ct);

                    await contentDb.LessonAssets
                        .IgnoreQueryFilters()
                        .Where(a => lessonIds.Contains(a.LessonId))
                        .ExecuteDeleteAsync(ct);

                    await contentDb.Lessons
                        .IgnoreQueryFilters()
                        .Where(l => l.CourseId == cid)
                        .ExecuteDeleteAsync(ct);
                }
            }

            // Catalog
            await catalogDb.CourseReviews
                .Where(r => seedCourseIds.Contains(r.CourseId))
                .ExecuteDeleteAsync(ct);

            await catalogDb.Courses
                .Where(c => seedCourseIds.Contains(c.Id))
                .ExecuteDeleteAsync(ct);

            // Orders
            await ordersDb.Orders
                .Where(o => seedUserIds.Contains(o.BuyerId))
                .ExecuteDeleteAsync(ct);

            await ordersDb.Subscriptions
                .Where(s => seedUserIds.Contains(s.BuyerId))
                .ExecuteDeleteAsync(ct);

            // Identity (last)
            await usersDb.RefreshTokens
                .Where(t => seedUserIds.Contains(t.UserId))
                .ExecuteDeleteAsync(ct);

            var seedUsers = await usersDb.Users
                .Where(u => seedEmails.Contains(u.Email.Value))
                .ToListAsync(ct);

            usersDb.Users.RemoveRange(seedUsers);
            await usersDb.SaveChangesAsync(ct);

            return Results.Ok(new { ok = true, message = "Seed data deleted.", deletedUserCount = seedUsers.Count });
        })
        .WithName("DevReset")
        .Produces(StatusCodes.Status200OK);

        return app;
    }

    private static List<Lesson> CreateLessons(Guid courseId, Guid ownerId, (string Title, bool IsFreePreview)[] specs)
    {
        var list = new List<Lesson>();
        for (int i = 0; i < specs.Length; i++)
        {
            var lesson = Lesson.Create(courseId, ownerId, specs[i].Title, specs[i].IsFreePreview);
            lesson.Reorder(i);
            list.Add(lesson);
        }
        return list;
    }

    private static class SeedUsers
    {
        public const string Creator1Email = "alice@seed.knowledgemarket.dev";
        public const string Creator2Email = "bob@seed.knowledgemarket.dev";
        public const string Buyer1Email   = "carol@seed.knowledgemarket.dev";
        public const string Buyer2Email   = "dave@seed.knowledgemarket.dev";
        public const string DefaultPassword = "Seed@12345!";
    }
}
