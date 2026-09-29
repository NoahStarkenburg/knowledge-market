using Application.Abstractions;
using Shared.Abstractions;
using Infrastructure.Storage;
using Bogus;
using Domain.Catalog;
using Domain.Content;
using Domain.Identity;
using Domain.Orders;
using Infrastructure.Catalog;
using Infrastructure.Content;
using Infrastructure.Identity;
using Infrastructure.Orders;
using Microsoft.EntityFrameworkCore;

namespace Api.DataSeeding;

/// <summary>
/// Generates ~14,500+ realistic records across all tables with file uploads.
/// Deterministic via fixed Bogus seed. Idempotent (checks for existing data).
/// </summary>
public sealed class BulkDataSeeder
{
    private readonly UsersDbContext _usersDb;
    private readonly CatalogDbContext _catalogDb;
    private readonly ContentDbContext _contentDb;
    private readonly OrdersDbContext _ordersDb;
    private readonly IStorage _storage;
    private readonly IContentStorage _contentStorage;
    private readonly ILogger<BulkDataSeeder> _logger;

    public BulkDataSeeder(
        UsersDbContext usersDb,
        CatalogDbContext catalogDb,
        ContentDbContext contentDb,
        OrdersDbContext ordersDb,
        IStorage storage,
        IContentStorage contentStorage,
        ILogger<BulkDataSeeder> logger)
    {
        _usersDb = usersDb;
        _catalogDb = catalogDb;
        _contentDb = contentDb;
        _ordersDb = ordersDb;
        _storage = storage;
        _contentStorage = contentStorage;
        _logger = logger;
    }

    public async Task<bool> IsAlreadySeededAsync(CancellationToken ct) =>
        await _usersDb.Users.AnyAsync(u => u.Email.Value.EndsWith(BulkSeedConstants.EmailDomain), ct);

    public async Task<SeedResult> SeedAsync(CancellationToken ct)
    {
        var result = new SeedResult();
        var faker = new Faker { Random = new Randomizer(BulkSeedConstants.BogusRandomSeed) };

        // ── 1. Users ──────────────────────────────────────────────────
        _logger.LogInformation("Bulk seed: creating users...");
        var (creators, buyers) = CreateUsers(faker);
        var allUsers = creators.Concat(buyers).ToList();

        foreach (var batch in allUsers.Chunk(BulkSeedConstants.BatchSize))
        {
            _usersDb.Users.AddRange(batch);
            await _usersDb.SaveChangesAsync(ct);
            _usersDb.ChangeTracker.Clear();
        }
        result.Users = allUsers.Count;

        // ── 2. Courses ────────────────────────────────────────────────
        _logger.LogInformation("Bulk seed: creating courses...");
        var courses = CreateCourses(faker, creators);

        foreach (var batch in courses.Chunk(BulkSeedConstants.BatchSize))
        {
            _catalogDb.Courses.AddRange(batch);
            await _catalogDb.SaveChangesAsync(ct);
            _catalogDb.ChangeTracker.Clear();
        }
        result.Courses = courses.Count;

        // ── 3. Lessons ────────────────────────────────────────────────
        _logger.LogInformation("Bulk seed: creating lessons...");
        var lessons = CreateLessons(faker, courses);

        foreach (var batch in lessons.Chunk(BulkSeedConstants.BatchSize))
        {
            _contentDb.Lessons.AddRange(batch);
            await _contentDb.SaveChangesAsync(ct);
            _contentDb.ChangeTracker.Clear();
        }
        result.Lessons = lessons.Count;

        // ── 4. Lesson markdown content ────────────────────────────────
        _logger.LogInformation("Bulk seed: writing lesson markdown...");
        var semaphore = new SemaphoreSlim(BulkSeedConstants.FileUploadConcurrency);
        var markdownTasks = lessons.Select(async lesson =>
        {
            await semaphore.WaitAsync(ct);
            try
            {
                var course = courses.First(c => c.Id == lesson.CourseId);
                var body = GenerateLessonMarkdown(faker, lesson.Title, course.Title.Value);
                var path = await _contentStorage.SaveLessonBodyAsync(lesson.CourseId, lesson.Id, body, ct);
                return (lesson, path);
            }
            finally
            {
                semaphore.Release();
            }
        }).ToList();

        var markdownResults = await Task.WhenAll(markdownTasks);
        result.LessonMarkdownWrites = markdownResults.Length;

        // Update storage paths - we need to reload lessons since tracker was cleared
        var lessonPathMap = markdownResults.ToDictionary(r => r.lesson.Id, r => r.path);
        foreach (var batch in lessons.Chunk(BulkSeedConstants.BatchSize))
        {
            var ids = batch.Select(l => l.Id).ToList();
            var dbLessons = await _contentDb.Lessons.Where(l => ids.Contains(l.Id)).ToListAsync(ct);
            foreach (var dbLesson in dbLessons)
            {
                if (lessonPathMap.TryGetValue(dbLesson.Id, out var path))
                    dbLesson.SetStoragePath(path);
            }
            await _contentDb.SaveChangesAsync(ct);
            _contentDb.ChangeTracker.Clear();
        }

        // ── 5. LessonAssetTexts ───────────────────────────────────────
        _logger.LogInformation("Bulk seed: creating lesson asset texts...");
        var assetTexts = CreateAssetTexts(faker, lessons, courses);

        foreach (var batch in assetTexts.Chunk(BulkSeedConstants.BatchSize))
        {
            _contentDb.LessonAssetTexts.AddRange(batch);
            await _contentDb.SaveChangesAsync(ct);
            _contentDb.ChangeTracker.Clear();
        }
        result.LessonAssetTexts = assetTexts.Count;

        // ── 6. ContentFiles + file uploads ────────────────────────────
        _logger.LogInformation("Bulk seed: uploading files...");
        var lessonsWithFiles = lessons.Where((_, i) => i % 2 == 0).ToList(); // ~50%
        var contentFiles = new List<ContentFile>();
        var fileSemaphore = new SemaphoreSlim(BulkSeedConstants.FileUploadConcurrency);

        var uploadTasks = lessonsWithFiles.Select(async (lesson, index) =>
        {
            await fileSemaphore.WaitAsync(ct);
            try
            {
                var (bytes, mime, ext) = PickFileType(index);
                var fileName = $"attachment-{index:D4}.{ext}";
                using var stream = new MemoryStream(bytes);
                var storageKey = await _storage.SaveAsync(lesson.OwnerId, fileName, mime, stream, ct);
                return new ContentFile(lesson.OwnerId, storageKey, fileName, bytes.Length, mime);
            }
            finally
            {
                fileSemaphore.Release();
            }
        }).ToList();

        var uploadedFiles = await Task.WhenAll(uploadTasks);
        contentFiles.AddRange(uploadedFiles);

        foreach (var batch in contentFiles.Chunk(BulkSeedConstants.BatchSize))
        {
            _contentDb.ContentFiles.AddRange(batch);
            await _contentDb.SaveChangesAsync(ct);
            _contentDb.ChangeTracker.Clear();
        }
        result.ContentFiles = contentFiles.Count;

        // ── 7. LessonAssets ───────────────────────────────────────────
        _logger.LogInformation("Bulk seed: linking lesson assets...");
        var lessonAssets = new List<LessonAsset>();
        for (int i = 0; i < lessonsWithFiles.Count; i++)
        {
            var lesson = lessonsWithFiles[i];
            var cf = contentFiles[i];
            lessonAssets.Add(new LessonAsset(lesson.Id, cf.Id, cf.FileTitle, 0));
        }

        foreach (var batch in lessonAssets.Chunk(BulkSeedConstants.BatchSize))
        {
            _contentDb.LessonAssets.AddRange(batch);
            await _contentDb.SaveChangesAsync(ct);
            _contentDb.ChangeTracker.Clear();
        }
        result.LessonAssets = lessonAssets.Count;

        // ── 8. Orders ─────────────────────────────────────────────────
        _logger.LogInformation("Bulk seed: creating orders...");
        var orders = CreateOrders(faker, buyers, courses);

        foreach (var batch in orders.Chunk(BulkSeedConstants.BatchSize))
        {
            _ordersDb.Orders.AddRange(batch);
            await _ordersDb.SaveChangesAsync(ct);
            _ordersDb.ChangeTracker.Clear();
        }
        result.Orders = orders.Count;

        // ── 9. Reviews ────────────────────────────────────────────────
        _logger.LogInformation("Bulk seed: creating reviews...");
        var reviews = CreateReviews(faker, orders);

        foreach (var batch in reviews.Chunk(BulkSeedConstants.BatchSize))
        {
            _catalogDb.CourseReviews.AddRange(batch);
            await _catalogDb.SaveChangesAsync(ct);
            _catalogDb.ChangeTracker.Clear();
        }
        result.Reviews = reviews.Count;

        // ── 10. LessonProgress ────────────────────────────────────────
        _logger.LogInformation("Bulk seed: creating lesson progress...");
        var progress = CreateProgress(faker, orders, lessons);

        foreach (var batch in progress.Chunk(BulkSeedConstants.BatchSize))
        {
            _contentDb.LessonProgress.AddRange(batch);
            await _contentDb.SaveChangesAsync(ct);
            _contentDb.ChangeTracker.Clear();
        }
        result.LessonProgress = progress.Count;

        // ── 11. Subscriptions ─────────────────────────────────────────
        _logger.LogInformation("Bulk seed: creating subscriptions...");
        var subscriptions = CreateSubscriptions(faker, buyers, creators);

        foreach (var batch in subscriptions.Chunk(BulkSeedConstants.BatchSize))
        {
            _ordersDb.Subscriptions.AddRange(batch);
            await _ordersDb.SaveChangesAsync(ct);
            _ordersDb.ChangeTracker.Clear();
        }
        result.Subscriptions = subscriptions.Count;

        _logger.LogInformation("Bulk seed complete: {Total} total records", result.Total);
        return result;
    }

    // ── Factory methods ───────────────────────────────────────────────

    private static (List<User> creators, List<User> buyers) CreateUsers(Faker faker)
    {
        var creators = new List<User>();
        for (int i = 1; i <= BulkSeedConstants.CreatorCount; i++)
        {
            var firstName = faker.Name.FirstName();
            var email = $"creator{i:D3}{BulkSeedConstants.EmailDomain}";
            var user = User.Register(email, BulkSeedConstants.DefaultPassword);
            user.VerifyEmail(user.VerificationToken!);
            user.SetDisplayName($"{firstName} {faker.Name.LastName()}");
            creators.Add(user);
        }

        var buyers = new List<User>();
        for (int i = 1; i <= BulkSeedConstants.BuyerCount; i++)
        {
            var firstName = faker.Name.FirstName();
            var email = $"buyer{i:D3}{BulkSeedConstants.EmailDomain}";
            var user = User.Register(email, BulkSeedConstants.DefaultPassword);
            user.VerifyEmail(user.VerificationToken!);
            user.SetDisplayName($"{firstName} {faker.Name.LastName()}");
            buyers.Add(user);
        }

        return (creators, buyers);
    }

    private static List<Course> CreateCourses(Faker faker, List<User> creators)
    {
        var courses = new List<Course>();

        for (int creatorIdx = 0; creatorIdx < creators.Count; creatorIdx++)
        {
            var creator = creators[creatorIdx];
            var topicGroup = BulkSeedConstants.Topics[creatorIdx % BulkSeedConstants.Topics.Length];

            for (int courseIdx = 0; courseIdx < BulkSeedConstants.CoursesPerCreator; courseIdx++)
            {
                var spec = topicGroup.Courses[courseIdx % topicGroup.Courses.Length];
                var isFree = courseIdx < 2; // 20% free (first 2 of 10)
                var price = isFree ? 0m : faker.Random.Int(4_99, 50_00);

                var course = Course.Create(
                    spec.Title,
                    spec.Description,
                    price,
                    "usd",
                    creator.Id);
                course.SetTags(topicGroup.Tags);
                course.Publish();
                courses.Add(course);
            }
        }

        return courses;
    }

    private static List<Lesson> CreateLessons(Faker faker, List<Course> courses)
    {
        var lessons = new List<Lesson>();
        var lessonTitlePrefixes = new[]
        {
            "Introduction to", "Getting Started with", "Deep Dive into", "Mastering",
            "Advanced", "Practical", "Understanding", "Working with", "Building with",
            "Exploring", "Hands-on", "Real-World", "Essential", "Complete Guide to",
        };

        foreach (var course in courses)
        {
            var count = faker.Random.Int(BulkSeedConstants.MinLessonsPerCourse, BulkSeedConstants.MaxLessonsPerCourse);
            for (int i = 0; i < count; i++)
            {
                var prefix = faker.PickRandom(lessonTitlePrefixes);
                var topicWord = faker.Lorem.Word();
                // Capitalize first letter of topic word
                topicWord = char.ToUpperInvariant(topicWord[0]) + topicWord[1..];
                var title = $"{prefix} {topicWord}";

                // Ensure title is at least 3 chars (factory requirement)
                if (title.Length < 3) title = $"{prefix} Basics";

                var isFreePreview = i == 0; // first lesson is always free preview
                var lesson = Lesson.Create(course.Id, course.CreatedById, title, isFreePreview);
                lesson.Reorder(i);
                lessons.Add(lesson);
            }
        }

        return lessons;
    }

    private static string GenerateLessonMarkdown(Faker faker, string lessonTitle, string courseTitle)
    {
        var paragraphs = faker.Lorem.Paragraphs(faker.Random.Int(2, 5));
        var language = faker.PickRandom("typescript", "python", "csharp", "sql", "bash", "go", "rust");
        var codeSnippet = language switch
        {
            "typescript" => "const result = await fetchData<T>(endpoint);\nconsole.log(result);",
            "python" => "import pandas as pd\ndf = pd.read_csv('data.csv')\nprint(df.describe())",
            "csharp" => "var items = await context.Items\n    .Where(x => x.IsActive)\n    .ToListAsync();",
            "sql" => "SELECT c.name, COUNT(o.id) AS order_count\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nGROUP BY c.name;",
            "bash" => "#!/bin/bash\nfor file in *.log; do\n  echo \"Processing $file\"\n  gzip \"$file\"\ndone",
            "go" => "func handler(w http.ResponseWriter, r *http.Request) {\n    json.NewEncoder(w).Encode(response)\n}",
            "rust" => "fn main() {\n    let data: Vec<i32> = (0..100).collect();\n    println!(\"{:?}\", &data[..5]);\n}",
            _ => "// example code"
        };

        return $"""
            ## {lessonTitle}

            *Part of the course: {courseTitle}*

            {paragraphs}

            ### Key Concepts

            - {faker.Lorem.Sentence()}
            - {faker.Lorem.Sentence()}
            - {faker.Lorem.Sentence()}

            ### Code Example

            ```{language}
            {codeSnippet}
            ```

            ### Summary

            {faker.Lorem.Paragraph()}
            """;
    }

    private static List<LessonAssetText> CreateAssetTexts(Faker faker, List<Lesson> lessons, List<Course> courses)
    {
        var texts = new List<LessonAssetText>();
        foreach (var lesson in lessons)
        {
            var course = courses.First(c => c.Id == lesson.CourseId);
            var body = $"## Reading Notes: {lesson.Title}\n\n{faker.Lorem.Paragraphs(2)}\n\n" +
                       $"**Key takeaway:** {faker.Lorem.Sentence()}";
            texts.Add(LessonAssetText.Create(lesson.Id, lesson.OwnerId, "Reading", body, 0));
        }
        return texts;
    }

    private static (byte[] bytes, string mime, string ext) PickFileType(int index)
    {
        var mod = index % 10;
        return mod switch
        {
            < 4 => (BulkSeedConstants.MinimalPng, "image/png", "png"),       // 40%
            < 7 => (BulkSeedConstants.MinimalPdf, "application/pdf", "pdf"), // 30%
            _   => (BulkSeedConstants.MinimalMp4, "video/mp4", "mp4"),       // 30%
        };
    }

    private static List<Order> CreateOrders(Faker faker, List<User> buyers, List<Course> courses)
    {
        var orders = new List<Order>();
        var usedPairs = new HashSet<(Guid buyerId, Guid courseId)>();

        foreach (var buyer in buyers)
        {
            var count = faker.Random.Int(BulkSeedConstants.MinOrdersPerBuyer, BulkSeedConstants.MaxOrdersPerBuyer);
            var shuffled = faker.Random.Shuffle(courses).Take(count);

            foreach (var course in shuffled)
            {
                var pair = (buyer.Id, course.Id);
                if (!usedPairs.Add(pair)) continue; // skip duplicates (unique constraint)

                var order = Order.Create(
                    buyer.Id,
                    course.Id,
                    course.Title.Value,
                    course.Price.Amount,
                    course.Price.Currency);
                order.MarkPaid();
                orders.Add(order);
            }
        }

        return orders;
    }

    private static List<CourseReview> CreateReviews(Faker faker, List<Order> orders)
    {
        var reviews = new List<CourseReview>();
        var reviewedPairs = new HashSet<(Guid courseId, Guid reviewerId)>();

        // ~50% of orders get a review
        var ordersToReview = orders.Where((_, i) => i % 2 == 0);

        foreach (var order in ordersToReview)
        {
            var pair = (order.CourseId, order.BuyerId);
            if (!reviewedPairs.Add(pair)) continue; // unique (CourseId, ReviewerId)

            // Weighted rating: 5% 1-star, 5% 2-star, 15% 3-star, 35% 4-star, 40% 5-star
            var rating = faker.Random.WeightedRandom(
                new[] { 1, 2, 3, 4, 5 },
                new[] { 0.05f, 0.05f, 0.15f, 0.35f, 0.40f });

            var comment = rating switch
            {
                >= 4 => faker.PickRandom(BulkSeedConstants.PositiveComments),
                3 => faker.PickRandom(BulkSeedConstants.NeutralComments),
                _ => faker.PickRandom(BulkSeedConstants.NegativeComments),
            };

            reviews.Add(CourseReview.Create(order.CourseId, order.BuyerId, rating, comment));
        }

        return reviews;
    }

    private static List<LessonProgress> CreateProgress(Faker faker, List<Order> orders, List<Lesson> lessons)
    {
        var progress = new List<LessonProgress>();
        var usedKeys = new HashSet<(Guid userId, Guid lessonId)>();

        // Group lessons by course for quick lookup
        var lessonsByCourse = lessons.GroupBy(l => l.CourseId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // For ~60% of orders, mark some lessons as complete
        var ordersForProgress = orders.Where((_, i) => i % 5 < 3); // ~60%

        foreach (var order in ordersForProgress)
        {
            if (!lessonsByCourse.TryGetValue(order.CourseId, out var courseLessons))
                continue;

            // Complete 1 to all lessons
            var completionCount = faker.Random.Int(1, courseLessons.Count);
            foreach (var lesson in courseLessons.Take(completionCount))
            {
                var key = (order.BuyerId, lesson.Id);
                if (!usedKeys.Add(key)) continue;

                progress.Add(LessonProgress.Create(order.BuyerId, lesson.Id, order.CourseId));
            }
        }

        return progress;
    }

    private static List<Subscription> CreateSubscriptions(Faker faker, List<User> buyers, List<User> creators)
    {
        var subscriptions = new List<Subscription>();

        // First N buyers get subscriptions to random creators
        var subscriberCount = Math.Min(BulkSeedConstants.SubscriptionCount, buyers.Count);

        for (int i = 0; i < subscriberCount; i++)
        {
            var buyer = buyers[i];
            var creator = faker.PickRandom(creators);
            var sub = new Subscription(Guid.NewGuid(), buyer.Id, creator.Id);

            // Vary subscription states: 70% active, 15% canceled, 15% past-due
            var roll = faker.Random.Int(1, 100);
            if (roll > 85)
                sub.MarkPastDue();
            else if (roll > 70)
                sub.Cancel();

            subscriptions.Add(sub);
        }

        return subscriptions;
    }

    public sealed class SeedResult
    {
        public int Users { get; set; }
        public int Courses { get; set; }
        public int Lessons { get; set; }
        public int LessonMarkdownWrites { get; set; }
        public int LessonAssetTexts { get; set; }
        public int ContentFiles { get; set; }
        public int LessonAssets { get; set; }
        public int Orders { get; set; }
        public int Reviews { get; set; }
        public int LessonProgress { get; set; }
        public int Subscriptions { get; set; }
        public int Total => Users + Courses + Lessons + LessonMarkdownWrites +
                            LessonAssetTexts + ContentFiles + LessonAssets +
                            Orders + Reviews + LessonProgress + Subscriptions;
    }
}
