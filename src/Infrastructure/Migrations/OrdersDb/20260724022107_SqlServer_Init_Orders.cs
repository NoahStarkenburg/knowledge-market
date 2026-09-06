using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations.OrdersDb
{
    /// <inheritdoc />
    public partial class SqlServer_Init_Orders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "orders");

            migrationBuilder.CreateTable(
                name: "idempotency",
                schema: "orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    key = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_idempotency", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "orders",
                schema: "orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    course_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    course_title_snapshot = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    price_amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    price_currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    paid_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    stripe_payment_intent_id = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orders", x => x.Id);
                    table.CheckConstraint("ck_orders_currency_iso3", "LEN(price_currency)=3 AND price_currency COLLATE Latin1_General_CS_AS LIKE '[a-z][a-z][a-z]'");
                    table.CheckConstraint("ck_orders_price_amount_nonneg", "price_amount >= 0");
                });

            migrationBuilder.CreateTable(
                name: "subscriptions",
                schema: "orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    courses_owner_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    current_period_start = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    current_period_end = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    stripe_subscription_id = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subscriptions", x => x.Id);
                    table.CheckConstraint("ck_subscriptions_period", "current_period_end > current_period_start");
                });

            migrationBuilder.CreateIndex(
                name: "IX_idempotency_buyer_id_key",
                schema: "orders",
                table: "idempotency",
                columns: new[] { "buyer_id", "key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_idempotency_order_id",
                schema: "orders",
                table: "idempotency",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "IX_orders_buyer_id_course_id",
                schema: "orders",
                table: "orders",
                columns: new[] { "buyer_id", "course_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_orders_buyer_id_created_at",
                schema: "orders",
                table: "orders",
                columns: new[] { "buyer_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_orders_course_id",
                schema: "orders",
                table: "orders",
                column: "course_id");

            migrationBuilder.CreateIndex(
                name: "IX_orders_stripe_payment_intent_id",
                schema: "orders",
                table: "orders",
                column: "stripe_payment_intent_id",
                unique: true,
                filter: "stripe_payment_intent_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_subscriptions_buyer_id_courses_owner_id",
                schema: "orders",
                table: "subscriptions",
                columns: new[] { "buyer_id", "courses_owner_id" });

            migrationBuilder.CreateIndex(
                name: "IX_subscriptions_stripe_subscription_id",
                schema: "orders",
                table: "subscriptions",
                column: "stripe_subscription_id",
                unique: true,
                filter: "stripe_subscription_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "idempotency",
                schema: "orders");

            migrationBuilder.DropTable(
                name: "orders",
                schema: "orders");

            migrationBuilder.DropTable(
                name: "subscriptions",
                schema: "orders");
        }
    }
}
