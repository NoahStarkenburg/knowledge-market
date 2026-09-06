using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations.ContentDb
{
    /// <inheritdoc />
    public partial class SqlServer_Init_Content : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "content");

            migrationBuilder.CreateTable(
                name: "ContentFiles",
                schema: "content",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StorageKey = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    FileTitle = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    MimeType = table.Column<string>(type: "nvarchar(127)", maxLength: 127, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContentFiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "lesson_progress",
                schema: "content",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    lesson_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    course_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    completed_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lesson_progress", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LessonAssets",
                schema: "content",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LessonId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContentFileId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LessonAssets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "lessons",
                schema: "content",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    course_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    owner_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    is_free_preview = table.Column<bool>(type: "bit", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    storage_path = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lessons", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "lesson_texts",
                schema: "content",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LessonId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Text = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lesson_texts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_lesson_texts_lessons_LessonId",
                        column: x => x.LessonId,
                        principalSchema: "content",
                        principalTable: "lessons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ContentFiles_UserId_StorageKey",
                schema: "content",
                table: "ContentFiles",
                columns: new[] { "UserId", "StorageKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lesson_progress_user_id_course_id",
                schema: "content",
                table: "lesson_progress",
                columns: new[] { "user_id", "course_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lesson_progress_user_id_lesson_id",
                schema: "content",
                table: "lesson_progress",
                columns: new[] { "user_id", "lesson_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lesson_texts_LessonId_deleted_at_SortOrder",
                schema: "content",
                table: "lesson_texts",
                columns: new[] { "LessonId", "deleted_at", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_LessonAssets_LessonId_ContentFileId",
                schema: "content",
                table: "LessonAssets",
                columns: new[] { "LessonId", "ContentFileId" },
                unique: true,
                filter: "[deleted_at] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_LessonAssets_LessonId_deleted_at_SortOrder",
                schema: "content",
                table: "LessonAssets",
                columns: new[] { "LessonId", "deleted_at", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_lessons_course_id_deleted_at_created_at",
                schema: "content",
                table: "lessons",
                columns: new[] { "course_id", "deleted_at", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ContentFiles",
                schema: "content");

            migrationBuilder.DropTable(
                name: "lesson_progress",
                schema: "content");

            migrationBuilder.DropTable(
                name: "lesson_texts",
                schema: "content");

            migrationBuilder.DropTable(
                name: "LessonAssets",
                schema: "content");

            migrationBuilder.DropTable(
                name: "lessons",
                schema: "content");
        }
    }
}
