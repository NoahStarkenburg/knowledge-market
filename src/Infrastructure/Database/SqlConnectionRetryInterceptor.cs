using System.Data.Common;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Infrastructure.Database;

// Retries OPENING a SQL connection when SQL answers with a transient error, and nothing else.
//
// The case this exists for: the Azure SQL free-offer database is serverless and pauses when idle. The
// first login after that fails with error 40613 ("database is not currently available") while it
// resumes, which takes up to a minute. Retrying the open turns that into one slow request instead of an
// error page.
//
// Why not EF Core's EnableRetryOnFailure: it retries whole operations, which means every explicit
// transaction (order checkout, cascading deletes) would have to be rewrapped in an execution strategy
// and made safe to run twice. Opening a connection is safe to repeat, and a paused database fails at
// exactly that point.
//
// Attached when EF creates the connection rather than when it opens it, because the Dapper queries in
// CourseRepository open EF's connection themselves.
public sealed class SqlConnectionRetryInterceptor : DbConnectionInterceptor
{
    public static readonly SqlConnectionRetryInterceptor Instance = new();

    // SqlClient's default list of transient errors, which includes 40613. Waits grow from about a
    // second up to 20 seconds between tries, a little over a minute in total.
    public static readonly SqlRetryLogicBaseProvider RetryProvider =
        SqlConfigurableRetryFactory.CreateExponentialRetryProvider(new SqlRetryLogicOption
        {
            NumberOfTries = 7,
            DeltaTime = TimeSpan.FromSeconds(1),
            MaxTimeInterval = TimeSpan.FromSeconds(20),
        });

    public override DbConnection ConnectionCreated(ConnectionCreatedEventData eventData, DbConnection result)
    {
        if (result is SqlConnection sql)
            sql.RetryLogicProvider = RetryProvider;
        return result;
    }
}
