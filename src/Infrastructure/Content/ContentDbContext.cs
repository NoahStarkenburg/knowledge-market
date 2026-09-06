using Domain.Content;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Content
{
    public sealed class ContentDbContext : DbContext
    {
        public ContentDbContext(DbContextOptions<ContentDbContext> options) : base(options) { }
        public DbSet<Lesson> Lessons => Set<Lesson>();
        public DbSet<ContentFile> ContentFiles => Set<ContentFile>();
        public DbSet<Domain.Content.LessonAsset> LessonAssets => Set<Domain.Content.LessonAsset>();

        public DbSet<Domain.Content.LessonAssetText> LessonAssetTexts => Set<Domain.Content.LessonAssetText>();
        public DbSet<Domain.Content.LessonProgress> LessonProgress => Set<Domain.Content.LessonProgress>();


        protected override void OnModelCreating(ModelBuilder b)
        {
            b.HasDefaultSchema("content");

            b.Entity<Lesson>(e =>
            {
                e.ToTable("lessons");
                e.HasKey(x => x.Id);
                e.Property(x => x.CourseId).HasColumnName("course_id").IsRequired();
                e.Property(x => x.OwnerId).HasColumnName("owner_id").IsRequired();
                e.Property(x => x.Title).HasColumnName("title").HasMaxLength(200).IsRequired();
                e.Property(x => x.IsFreePreview).HasColumnName("is_free_preview").IsRequired();
                e.Property(x => x.SortOrder).HasColumnName("sort_order").IsRequired().HasDefaultValue(0);
                e.Property(x => x.StoragePath).HasColumnName("storage_path");
                e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
                e.Property(x => x.DeletedAt)
 .HasColumnName("deleted_at")
 ;

                e.HasQueryFilter(x => x.DeletedAt == null);

                // better “list lessons for a course” index under soft delete:
                e.HasIndex(x => new { x.CourseId, x.DeletedAt, x.CreatedAt });

            });

            var files = b.Entity<Infrastructure.Content.ContentFile>();
            files.ToTable("ContentFiles", "content");
            files.HasKey(f => f.Id);
            files.Property(f => f.StorageKey).IsRequired().HasMaxLength(512);
            files.Property(f => f.FileTitle).IsRequired().HasMaxLength(255);
            files.Property(f => f.MimeType).IsRequired().HasMaxLength(127);
            files.HasIndex(f => new { f.UserId, f.StorageKey }).IsUnique();

            var assets = b.Entity<LessonAsset>();
            assets.ToTable("LessonAssets", "content");
            assets.HasKey(a => a.Id);
            assets.Property(a => a.Title).IsRequired().HasMaxLength(255);
            assets.HasIndex(a => new { a.LessonId, a.ContentFileId })
      .IsUnique()
      .HasFilter("[deleted_at] IS NULL");

            assets.Property(a => a.DeletedAt)
      .HasColumnName("deleted_at")
      ;

            assets.HasQueryFilter(a => a.DeletedAt == null);

            assets.HasIndex(a => new { a.LessonId, a.DeletedAt, a.SortOrder });


            b.Entity<Domain.Content.LessonAssetText>(e =>
            {
                e.ToTable("lesson_texts");
                e.HasKey(x => x.Id);
                e.Property(x => x.Title).HasMaxLength(300).IsRequired();
                e.Property(x => x.Text).HasColumnType("nvarchar(max)").IsRequired();
                e.Property(x => x.SortOrder).IsRequired();
                e.Property(x => x.CreatedAt).IsRequired();

                e.Property(x => x.DeletedAt)
  .HasColumnName("deleted_at")
  ;

                e.HasQueryFilter(x => x.DeletedAt == null);

                e.HasIndex(x => new { x.LessonId, x.DeletedAt, x.SortOrder });

                e.HasOne<Lesson>()
                    .WithMany()
                    .HasForeignKey(x => x.LessonId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            b.Entity<Domain.Content.LessonProgress>(e =>
            {
                e.ToTable("lesson_progress");
                e.HasKey(x => x.Id);
                e.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
                e.Property(x => x.LessonId).HasColumnName("lesson_id").IsRequired();
                e.Property(x => x.CourseId).HasColumnName("course_id").IsRequired();
                e.Property(x => x.CompletedAt).HasColumnName("completed_at").IsRequired();

                // One completion record per user per lesson
                e.HasIndex(x => new { x.UserId, x.LessonId }).IsUnique();
                // Fast "get all completed lessons for a user in a course"
                e.HasIndex(x => new { x.UserId, x.CourseId });
            });
        }
    }
}
