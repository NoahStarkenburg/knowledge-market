using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Infrastructure.Catalog;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Infrastructure.Content
{
    public sealed class ContentDbContextFactory : IDesignTimeDbContextFactory<ContentDbContext>
    {
        public ContentDbContext CreateDbContext(string[] args)
        {
            var conn = Environment.GetEnvironmentVariable("KM_DESIGNTIME_CONN")
                ?? "Server=localhost,1433;Database=km;User Id=sa;Password=Learn@SqlServer123;TrustServerCertificate=true";

            var opts = new DbContextOptionsBuilder<ContentDbContext>()
                .UseSqlServer(conn, b => b.MigrationsHistoryTable("__EFMigrationsHistory", "content"))
                .Options;
            return new ContentDbContext(opts);
        }
    }
}
