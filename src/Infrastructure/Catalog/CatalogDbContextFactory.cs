using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Infrastructure.Catalog
{
    public sealed class CatalogDbContextFactory : IDesignTimeDbContextFactory<CatalogDbContext>
    {
        public CatalogDbContext CreateDbContext(string[] args)
        {
            var conn = Environment.GetEnvironmentVariable("KM_DESIGNTIME_CONN")
                ?? "Server=localhost,1433;Database=km;User Id=sa;Password=Learn@SqlServer123;TrustServerCertificate=true";

            var opts = new DbContextOptionsBuilder<CatalogDbContext>()
                .UseSqlServer(conn, b => b.MigrationsHistoryTable("__EFMigrationsHistory", "catalog"))
                .Options;
            return new CatalogDbContext(opts);
        }
    }
}
