using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Infrastructure.Identity;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Orders
{
    internal class OrdersDbContextFactory : IDesignTimeDbContextFactory<OrdersDbContext>
    {
        public OrdersDbContext CreateDbContext(string[] args)
        {
            var conn = Environment.GetEnvironmentVariable("KM_DESIGNTIME_CONN")
                ?? "Server=localhost,1433;Database=km;User Id=sa;Password=Learn@SqlServer123;TrustServerCertificate=true";
            var opts = new DbContextOptionsBuilder<OrdersDbContext>()
                // NOTE: only for local dev
                .UseSqlServer(conn, b => b.MigrationsHistoryTable("__EFMigrationsHistory", "orders"))
                .Options;
            return new OrdersDbContext(opts);
        }
    }
}
