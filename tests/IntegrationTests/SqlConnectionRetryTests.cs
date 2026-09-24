using System.Data;
using System.Diagnostics;
using Infrastructure.Cart;
using Infrastructure.Catalog;
using Infrastructure.Content;
using Infrastructure.Database;
using Infrastructure.Identity;
using Infrastructure.Orders;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests;

[Collection("api")]
public class SqlConnectionRetryTests
{
    private readonly ApiFactory _factory;

    public SqlConnectionRetryTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public void Every_DbContext_retries_opening_its_connection()
    {
        using var scope = _factory.Services.CreateScope();
        DbContext[] contexts =
        [
            scope.ServiceProvider.GetRequiredService<UsersDbContext>(),
            scope.ServiceProvider.GetRequiredService<CatalogDbContext>(),
            scope.ServiceProvider.GetRequiredService<OrdersDbContext>(),
            scope.ServiceProvider.GetRequiredService<ContentDbContext>(),
            scope.ServiceProvider.GetRequiredService<CartDbContext>(),
        ];

        foreach (var db in contexts)
        {
            var connection = (SqlConnection)db.Database.GetDbConnection();
            Assert.Same(SqlConnectionRetryInterceptor.RetryProvider, connection.RetryLogicProvider);
        }
    }

    // A paused Azure SQL database fails the first login with 40613 until it has resumed. That can't be
    // produced locally, but 4060 ("cannot open database") is on the same list of transient errors, so a
    // database that doesn't exist YET stands in for one that is still waking up.
    [Fact]
    public async Task Opening_waits_for_a_database_that_comes_online()
    {
        var server = new SqlConnectionStringBuilder(
            _factory.Services.GetRequiredService<IConfiguration>().GetConnectionString("Default"));
        var name = $"retry_{Guid.NewGuid():N}";
        var target = new SqlConnectionStringBuilder(server.ConnectionString)
        {
            InitialCatalog = name,
            // Outside Azure, a failed open blocks the pool for a few seconds and repeats the same error
            // to every caller. Azure SQL has no blocking period, so turning it off matches production.
            PoolBlockingPeriod = PoolBlockingPeriod.NeverBlock,
        };

        await using (var plain = new SqlConnection(target.ConnectionString))
        {
            var error = await Assert.ThrowsAsync<SqlException>(() => plain.OpenAsync());
            Assert.Equal(4060, error.Number);
        }

        var createLater = Task.Run(async () =>
        {
            await Task.Delay(TimeSpan.FromSeconds(3));
            await using var master = new SqlConnection(
                new SqlConnectionStringBuilder(server.ConnectionString) { InitialCatalog = "master" }.ConnectionString);
            await master.OpenAsync();
            await new SqlCommand($"CREATE DATABASE [{name}]", master).ExecuteNonQueryAsync();
        });

        await using var retrying = new SqlConnection(target.ConnectionString)
        {
            RetryLogicProvider = SqlConnectionRetryInterceptor.RetryProvider,
        };
        var elapsed = Stopwatch.StartNew();
        await retrying.OpenAsync();
        await createLater;

        Assert.Equal(ConnectionState.Open, retrying.State);
        Assert.True(elapsed.Elapsed > TimeSpan.FromSeconds(2), $"opened after {elapsed.Elapsed}");
    }
}
