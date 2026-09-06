using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Domain.Identity;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Identity
{
    public sealed class UsersDbContext : DbContext, IDataProtectionKeyContext
    {
        public UsersDbContext(DbContextOptions<UsersDbContext> options) : base(options) { }

        public DbSet<User> Users => Set<User>();
        public DbSet<Role> Roles => Set<Role>();
        public DbSet<Permission> Permissions => Set<Permission>();
        public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
        public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

        protected override void OnModelCreating(ModelBuilder b)
        {
            b.HasDefaultSchema("identity");

            b.Entity<User>(e =>
            {
                e.ToTable("users");
                e.HasKey(x => x.Id);
                

                e.OwnsOne(x => x.Email, o =>
                {
                    o.Property(p => p.Value)
                     .HasColumnName("email")
                     .IsRequired();

                    o.HasIndex(p => p.Value).IsUnique();
                });


                e.Property(x => x.RegisteredAt)
                 .HasColumnName("registered_at")
                 
                 .IsRequired();

                e.Property(x => x.PasswordHash)
                 .HasColumnName("password_hash")
                 .HasMaxLength(200)
                 .IsRequired(false);

                e.Property(x => x.EmailVerifiedAt)
                 .HasColumnName("email_verified_at")
                 ;

                e.Property(x => x.VerificationToken)
                 .HasColumnName("verification_token")
                 .HasMaxLength(100);

                e.Property(x => x.VerificationTokenExpiresAt)
                 .HasColumnName("verification_token_expires_at")
                 ;

                e.HasIndex(x => x.VerificationToken).IsUnique().HasFilter("verification_token IS NOT NULL");

                e.Property(x => x.PasswordResetToken)
                 .HasColumnName("password_reset_token").HasMaxLength(100);
                e.Property(x => x.PasswordResetTokenExpiresAt)
                 .HasColumnName("password_reset_token_expires_at");
                e.HasIndex(x => x.PasswordResetToken).IsUnique()
                 .HasFilter("password_reset_token IS NOT NULL");

                e.Property(x => x.StripeCustomerId)
                 .HasColumnName("stripe_customer_id").HasMaxLength(64);
                e.HasIndex(x => x.StripeCustomerId).IsUnique()
                 .HasFilter("stripe_customer_id IS NOT NULL");

                e.Property(x => x.DisplayName)
                 .HasColumnName("display_name").HasMaxLength(100);

                e.Property(x => x.FailedLoginCount)
                 .HasColumnName("failed_login_count").HasDefaultValue(0);
                e.Property(x => x.LockoutEnd)
                 .HasColumnName("lockout_end");

                e.Property(x => x.ExternalProvider)
                 .HasColumnName("external_provider").HasMaxLength(32);
                e.Property(x => x.ExternalId)
                 .HasColumnName("external_id").HasMaxLength(256);
            });

            b.Entity<RefreshToken>(e =>
            {
                e.ToTable("refresh_tokens");
                e.HasKey(x => x.Id);
                e.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
                e.Property(x => x.Token).HasColumnName("token").HasMaxLength(200).IsRequired();
                e.Property(x => x.ExpiresAt).HasColumnName("expires_at").IsRequired();
                e.Property(x => x.RevokedAt).HasColumnName("revoked_at");
                e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
                e.HasIndex(x => x.Token).IsUnique();
                e.HasIndex(x => x.UserId);
            });

            b.Entity<Role>(e =>
            {
                e.ToTable("roles");
                e.HasKey(x => x.Id);
                e.HasIndex(x => x.Name).IsUnique();
                e.Property(x => x.Name).IsRequired();
                e.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            });

            // Permissions
            b.Entity<Permission>(e =>
            {
                e.ToTable("permissions");
                e.HasKey(x => x.Id);
                e.HasIndex(x => x.Name).IsUnique();
                e.Property(x => x.Name).IsRequired();
                e.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            });
            
            b.Entity<User>()
            .HasMany(u => u.Roles)
            .WithMany(r => r.Users)
            .UsingEntity<Dictionary<string, object>>(
                "user_roles",
                right => right.HasOne<Role>().WithMany()
                              .HasForeignKey("role_id")
                              .OnDelete(DeleteBehavior.Cascade),
                left => left.HasOne<User>().WithMany()
                              .HasForeignKey("user_id")
                              .OnDelete(DeleteBehavior.Cascade),
                j =>
                {
                    j.HasKey("user_id", "role_id");
                    j.ToTable("user_roles");
                    j.Property<DateTime>("granted_at").HasDefaultValueSql("SYSUTCDATETIME()");
                    j.HasIndex("role_id");
                });

            // Many-to-many: roles <-> permissions (join: role_permissions)
            b.Entity<Role>()
                .HasMany(r => r.Permissions)
                .WithMany(p => p.Roles)
                .UsingEntity<Dictionary<string, object>>(
                    "role_permissions",
                    right => right.HasOne<Permission>().WithMany()
                                   .HasForeignKey("permission_id")
                                   .OnDelete(DeleteBehavior.Cascade),
                    left => left.HasOne<Role>().WithMany()
                                   .HasForeignKey("role_id")
                                   .OnDelete(DeleteBehavior.Cascade),
                    j =>
                    {
                        j.HasKey("role_id", "permission_id");
                        j.ToTable("role_permissions");
                        j.Property<DateTime>("granted_at").HasDefaultValueSql("SYSUTCDATETIME()");
                    });
        }
    }
}
