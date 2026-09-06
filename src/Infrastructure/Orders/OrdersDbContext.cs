using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Domain.Orders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Orders
{
    public sealed class OrdersDbContext : DbContext
    {
        public OrdersDbContext(DbContextOptions<OrdersDbContext> options) : base(options) { }

        public DbSet<Order> Orders => Set<Order>();
        public DbSet<IdempotencyKey> IdempotencyKeys => Set<IdempotencyKey>();
        public DbSet<Subscription> Subscriptions => Set<Subscription>();

        protected override void OnModelCreating(ModelBuilder b)
        {
            b.HasDefaultSchema("orders");

            b.Entity<Order>(e =>
            {
                e.ToTable("orders");
                e.HasKey(x => x.Id);

                e.Property(x => x.BuyerId).HasColumnName("buyer_id").IsRequired();
                e.Property(x => x.CourseId).HasColumnName("course_id").IsRequired();
                e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();

                // Owned Money snapshot (price_amount, price_currency)
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

                e.Property(x => x.CourseTitleSnapshot)
                    .HasColumnName("course_title_snapshot")
                    .HasMaxLength(200)
                    .IsRequired();

                e.Property(x => x.Status)
                    .HasColumnName("status")
                    .HasConversion<int>()     // enum -> int
                    .IsRequired();

                e.Property(x => x.PaidAt)
                    .HasColumnName("paid_at")
                    ;

                e.Property(x => x.StripePaymentIntentId)
                    .HasColumnName("stripe_payment_intent_id")
                    .HasMaxLength(255);

                e.HasIndex(x => x.StripePaymentIntentId)
                    .IsUnique()
                    .HasFilter("stripe_payment_intent_id IS NOT NULL");

                //  Prevent duplicate purchases of the same course by the same buyer
                e.HasIndex(x => new { x.BuyerId, x.CourseId }).IsUnique();

                // Helpful read patterns
                e.HasIndex(x => new { x.BuyerId, x.CreatedAt }); // list "my orders" fast
                e.HasIndex(x => x.CourseId);

                // DB guardrails (belt & suspenders)
                e.ToTable(tb =>
                {
                    tb.HasCheckConstraint("ck_orders_price_amount_nonneg", "price_amount >= 0");
                    tb.HasCheckConstraint("ck_orders_currency_iso3", "LEN(price_currency)=3 AND price_currency COLLATE Latin1_General_CS_AS LIKE '[a-z][a-z][a-z]'");
                });

                // Optional optimistic concurrency with Postgres xmin (add later if/when needed)
                // e.Property<uint>("xmin").HasColumnName("xmin").IsRowVersion();
            });

            b.Entity<IdempotencyKey>(e =>
            {
                e.ToTable("idempotency");
                e.HasKey(x => x.Id);

                e.Property(x => x.BuyerId).HasColumnName("buyer_id").IsRequired();
                e.Property(x => x.OrderId).HasColumnName("order_id").IsRequired();

                e.Property(x => x.Key)
                    .HasColumnName("key")
                    .HasMaxLength(128)
                    .IsRequired();

                e.Property(x => x.CreatedAt)
                    .HasColumnName("created_at")
                    .HasDefaultValueSql("SYSUTCDATETIME()")
                    .IsRequired();

                // ✅ one key per buyer; protects against parallel POSTs
                e.HasIndex(x => new { x.BuyerId, x.Key }).IsUnique();
                e.HasIndex(x => x.OrderId);
            });

            b.Entity<Subscription>(e =>
            {
                e.ToTable("subscriptions");
                e.HasKey(x => x.Id);

                e.Property(x => x.BuyerId)
                    .HasColumnName("buyer_id")
                    .IsRequired();

                e.Property(x => x.CoursesOwnerId)
                    .HasColumnName("courses_owner_id")
                    .IsRequired();

                e.Property(x => x.Status)
                    .HasColumnName("status")
                    .HasConversion<int>()        // enum as int
                    .IsRequired();

                e.Property(x => x.CurrentPeriodStart)
                    .HasColumnName("current_period_start")
                    
                    .IsRequired();

                e.Property(x => x.CurrentPeriodEnd)
                    .HasColumnName("current_period_end")
                    
                    .IsRequired();

                e.Property(x => x.StripeSubscriptionId)
                    .HasColumnName("stripe_subscription_id")
                    .HasMaxLength(64);
                e.HasIndex(x => x.StripeSubscriptionId).IsUnique()
                    .HasFilter("stripe_subscription_id IS NOT NULL");

                // Fast lookups: "does this user have an active sub to this creator?"
                e.HasIndex(x => new { x.BuyerId, x.CoursesOwnerId });

                // Guardrails (optional)
                e.ToTable(tb =>
                {
                    tb.HasCheckConstraint(
                        "ck_subscriptions_period",
                        "current_period_end > current_period_start"
                    );
                });
            });
        }
    }
}
