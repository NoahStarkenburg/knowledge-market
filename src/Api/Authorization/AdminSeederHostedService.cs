// FILE: src/Api/Auth/AdminSeederHostedService.cs

using Domain.Identity;
using Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;

namespace Api.Authorization;

public sealed class AdminSeederHostedService(
    IServiceProvider services,
    IConfiguration cfg) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var adminEmailRaw = cfg["Admin:Email"];
        if (string.IsNullOrWhiteSpace(adminEmailRaw))
            return;

        var adminPassword = cfg["Admin:Password"];
        if (string.IsNullOrWhiteSpace(adminPassword))
            return;

        var adminEmail = Domain.Identity.Email.Create(adminEmailRaw).Value;

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<UsersDbContext>();

        // Ensure Admin role exists
        var adminRole = await db.Roles
            .FirstOrDefaultAsync(r => r.Name == "Admin", cancellationToken);

        if (adminRole is null)
        {
            adminRole = new Role
            {
                Id = Guid.NewGuid(),
                Name = "Admin"
            };

            db.Roles.Add(adminRole);
            await db.SaveChangesAsync(cancellationToken);
        }

        // Find or create user by email
        var user = await db.Users
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Email.Value == adminEmail, cancellationToken);

        if (user is null)
        {
            user = User.Register(adminEmailRaw, adminPassword);
            // Mark admin email as pre-verified
            user.VerifyEmail(user.VerificationToken!);
            db.Users.Add(user);
            await db.SaveChangesAsync(cancellationToken);

            // Re-fetch with roles included
            user = await db.Users
                .Include(u => u.Roles)
                .FirstAsync(u => u.Email.Value == adminEmail, cancellationToken);
        }

        if (user.Roles.All(r => r.Name != "Admin"))
        {
            user.Roles.Add(adminRole);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
