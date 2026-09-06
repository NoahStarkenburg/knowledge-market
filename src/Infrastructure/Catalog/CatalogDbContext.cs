using Domain.Catalog;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Catalog
{
    public sealed class CatalogDbContext : DbContext
    {
        public CatalogDbContext(DbContextOptions<CatalogDbContext> options) : base(options) { }

        public DbSet<Course> Courses => Set<Course>();
        public DbSet<CourseReview> CourseReviews => Set<CourseReview>();

        protected override void OnModelCreating(ModelBuilder b)
        {
            b.HasDefaultSchema("catalog");

            b.Entity<Course>(e =>
            {
                e.ToTable("courses");
                e.HasKey(x => x.Id);

                e.OwnsOne(x => x.Title, o =>
                {
                    o.Property(p => p.Value)
                     .HasColumnName("title")
                     .HasMaxLength(200)
                     .IsRequired();

                    // index on title (no magic string)
                    o.HasIndex(p => p.Value);
                });

                e.Property(d => d.Description)
                .HasColumnName("description")
                .HasMaxLength(3000)
                .IsRequired(false);

                e.OwnsOne(x => x.Price, o =>
                {
                    o.Property(p => p.Amount)
                     .HasColumnName("price_amount")
                     .HasColumnType("decimal(18,2)")
                     .IsRequired();

                    o.Property(p => p.Currency)
                     .HasColumnName("price_currency")
                     .HasMaxLength(3)
                     .IsRequired();
                });

                e.Property(x => x.Status)
                 .HasColumnName("status")
                 .IsRequired();

                e.Property(x => x.CreatedAt)
                 .HasColumnName("created_at")
                 .IsRequired();

                e.Property(x => x.PublishedAt)
                 .HasColumnName("published_at");

                e.Property(x => x.CreatedById)
                   .HasColumnName("created_by_id")
                   .IsRequired();

                e.Property(x => x.DeletedAt)
                 .HasColumnName("deleted_at");

                e.HasQueryFilter(x => x.DeletedAt == null);

                // DB-level guards. SQL Server has no POSIX regex operator, so the ISO-4217
                // shape is expressed as a LIKE pattern; the explicit case-sensitive collation
                // preserves the lowercase-only intent under the database's default CI collation.
                e.ToTable(tb =>
                {
                    tb.HasCheckConstraint("ck_courses_title_len", "LEN(title) BETWEEN 3 AND 200");
                    tb.HasCheckConstraint("ck_courses_price_amount_nonneg", "price_amount >= 0");
                    tb.HasCheckConstraint("ck_courses_currency_iso3", "LEN(price_currency)=3 AND price_currency COLLATE Latin1_General_CS_AS LIKE '[a-z][a-z][a-z]'");
                });

                // still fine to keep a typed index on status
                e.HasIndex(x => x.Status);
                // helpful for “my courses” and activity feeds
                e.HasIndex(x => new { x.CreatedById, x.DeletedAt, x.CreatedAt });

                // SQL Server has no array type. EF maps this primitive collection to a JSON
                // document in nvarchar(max), which keeps string[] on the domain model and
                // still lets queries reach into it via OPENJSON.
                e.Property(x => x.Tags)
                 .HasColumnName("tags")
                 .IsRequired()
                 .HasDefaultValue(Array.Empty<string>());

                e.Property(x => x.ThumbnailFileId)
                 .HasColumnName("thumbnail_file_id");

                e.Property(x => x.IntroVideoFileId)
                 .HasColumnName("intro_video_file_id");

                // Optimistic concurrency. Postgres exposed its system column xmin for free;
                // SQL Server needs a real rowversion column, kept as a shadow property so the
                // domain model stays free of persistence concerns.
                e.Property<byte[]>("RowVersion")
                 .HasColumnName("row_version")
                 .IsRowVersion();
            });

            b.Entity<CourseReview>(e =>
            {
                e.ToTable("course_reviews");
                e.HasKey(x => x.Id);

                e.Property(x => x.CourseId).HasColumnName("course_id").IsRequired();
                e.Property(x => x.ReviewerId).HasColumnName("reviewer_id").IsRequired();
                e.Property(x => x.Rating).HasColumnName("rating").IsRequired();
                e.Property(x => x.Comment).HasColumnName("comment").HasMaxLength(1000).IsRequired(false);
                e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();

                // one review per buyer per course
                e.HasIndex(x => new { x.CourseId, x.ReviewerId }).IsUnique();
                e.HasIndex(x => x.CourseId);

                e.ToTable(tb => tb.HasCheckConstraint("ck_reviews_rating", "rating BETWEEN 1 AND 5"));
            });
        }

    }
}
