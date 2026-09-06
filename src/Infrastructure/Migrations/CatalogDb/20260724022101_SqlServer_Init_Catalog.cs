using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations.CatalogDb
{
    /// <inheritdoc />
    public partial class SqlServer_Init_Catalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "catalog");

            migrationBuilder.CreateTable(
                name: "course_reviews",
                schema: "catalog",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    course_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reviewer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    rating = table.Column<int>(type: "int", nullable: false),
                    comment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_course_reviews", x => x.Id);
                    table.CheckConstraint("ck_reviews_rating", "rating BETWEEN 1 AND 5");
                });

            migrationBuilder.CreateTable(
                name: "courses",
                schema: "catalog",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "nvarchar(3000)", maxLength: 3000, nullable: true),
                    price_amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    price_currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    published_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    deleted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    created_by_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tags = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "[]"),
                    thumbnail_file_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    intro_video_file_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_courses", x => x.Id);
                    table.CheckConstraint("ck_courses_currency_iso3", "LEN(price_currency)=3 AND price_currency COLLATE Latin1_General_CS_AS LIKE '[a-z][a-z][a-z]'");
                    table.CheckConstraint("ck_courses_price_amount_nonneg", "price_amount >= 0");
                    table.CheckConstraint("ck_courses_title_len", "LEN(title) BETWEEN 3 AND 200");
                });

            migrationBuilder.CreateIndex(
                name: "IX_course_reviews_course_id",
                schema: "catalog",
                table: "course_reviews",
                column: "course_id");

            migrationBuilder.CreateIndex(
                name: "IX_course_reviews_course_id_reviewer_id",
                schema: "catalog",
                table: "course_reviews",
                columns: new[] { "course_id", "reviewer_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_courses_created_by_id_deleted_at_created_at",
                schema: "catalog",
                table: "courses",
                columns: new[] { "created_by_id", "deleted_at", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_courses_status",
                schema: "catalog",
                table: "courses",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_courses_title",
                schema: "catalog",
                table: "courses",
                column: "title");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "course_reviews",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "courses",
                schema: "catalog");
        }
    }
}
