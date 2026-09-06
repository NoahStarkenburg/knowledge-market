using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Infrastructure.Catalog;
using Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Infrastructure.Indentity
{
    public sealed class UsersDbContextFactory : IDesignTimeDbContextFactory<UsersDbContext>
    {
        public UsersDbContext CreateDbContext(string[] args)
        {
            var conn = Environment.GetEnvironmentVariable("KM_DESIGNTIME_CONN")
                ?? "Server=localhost,1433;Database=km;User Id=sa;Password=Learn@SqlServer123;TrustServerCertificate=true";
            var opts = new DbContextOptionsBuilder<UsersDbContext>()
                // NOTE: only for local dev
                .UseSqlServer(conn, b => b.MigrationsHistoryTable("__EFMigrationsHistory", "identity"))
                .Options;
            return new UsersDbContext(opts);
        }
    }
}
