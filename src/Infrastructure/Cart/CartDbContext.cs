using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Domain.Cart;
using Domain.Content;
using Infrastructure.Content;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Cart
{
    public sealed class CartDbContext : DbContext
    {
        public CartDbContext(DbContextOptions<CartDbContext> options) : base(options) { }
        public DbSet<Domain.Cart.Cart> Carts => Set<Domain.Cart.Cart>();
        public DbSet<Domain.Cart.CartItem> CartItems => Set<Domain.Cart.CartItem>();

        protected override void OnModelCreating(ModelBuilder b)
        {
            b.HasDefaultSchema("carts");

            b.Entity<Domain.Cart.Cart>(e =>
            {
                e.ToTable("carts");
                e.HasKey(e => e.Id);
                e.Property(e => e.BuyerId).HasColumnName("buyer_id").IsRequired();
                e.HasMany(c => c.Items)
                .WithOne()
                .HasForeignKey(c => c.CartId)
                .OnDelete(DeleteBehavior.Cascade);

                e.Navigation(c => c.Items)
                .UsePropertyAccessMode(PropertyAccessMode.Field);
                e.Property(e => e.CreatedAt).HasColumnName("created_at");
                e.Property(e => e.UpdatedAt).HasColumnName("updated_at");

                e.HasIndex(e => e.BuyerId).IsUnique();
            });

            b.Entity<Domain.Cart.CartItem>(e =>
            {
                e.ToTable("cart_items");
                e.HasKey(e => e.Id);
                e.Property(e => e.CartId).HasColumnName("cart_id").IsRequired();
                e.Property(e => e.CourseId).HasColumnName("course_id").IsRequired();
                e.Property(e => e.AddedAt).HasColumnName("added_at");

                e.HasIndex(x => new {x.CartId, x.CourseId}).IsUnique();
            });
        }
    }
}
