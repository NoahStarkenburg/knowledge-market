using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations.CatalogDb
{
    /// <inheritdoc />
    public partial class SqlServer_CatalogStatsFunction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Inline table-valued function: the SQL Server counterpart of the Postgres
            // set-returning function. Inline (rather than multi-statement) so the optimizer
            // expands it into the calling query instead of materialising a table variable.
            migrationBuilder.Sql(@"
CREATE OR ALTER FUNCTION catalog.catalog_stats()
RETURNS TABLE
AS
RETURN
(
    SELECT CAST(COUNT(*) AS int)                         AS PublishedCourses,
           CAST(COUNT(DISTINCT created_by_id) AS int)    AS Creators
    FROM catalog.courses
    WHERE status = 1 AND deleted_at IS NULL
);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS catalog.catalog_stats;");
        }
    }
}
