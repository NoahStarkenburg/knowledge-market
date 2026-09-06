using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Infrastructure.Cart;
using Infrastructure.Catalog;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Infrastructure.Cart
{
    public sealed class CartDbContextFactory : IDesignTimeDbContextFactory<CartDbContext>
    {
        public CartDbContext CreateDbContext(string[] args)
        {
            var conn = Environment.GetEnvironmentVariable("KM_DESIGNTIME_CONN")
                ?? "Server=localhost,1433;Database=km;User Id=sa;Password=Learn@SqlServer123;TrustServerCertificate=true";

            var opts = new DbContextOptionsBuilder<CartDbContext>()
                .UseSqlServer(conn, b => b.MigrationsHistoryTable("__EFMigrationsHistory", "carts"))
                .Options;
            return new CartDbContext(opts);
        }
    }
}
