using Domain.Catalog;
using Domain.Identity;
using Domain.Primatives;

namespace UnitTests;

// Pins the value-object rules. When these become plain scalar columns during the
// anemic flatten, the equivalent validation must live in the service/validator layer.
public class ValueObjectRulesTests
{
    [Theory]
    [InlineData("1.005", "1.01")]  // half rounds away from zero
    [InlineData("2.344", "2.34")]  // rounds down
    public void Money_rounds_to_two_decimals(string amount, string expected)
    {
        var money = Money.Create(decimal.Parse(amount), "USD");

        Assert.Equal(decimal.Parse(expected), money.Amount);
    }

    [Fact]
    public void Money_rejects_negative_amount()
        => Assert.Throws<ArgumentOutOfRangeException>(() => Money.Create(-1m, "USD"));

    [Fact]
    public void Money_normalizes_currency_to_lowercase()
    {
        var money = Money.Create(10m, "  USD ");

        Assert.Equal("usd", money.Currency);
    }

    [Theory]
    [InlineData("US")]     // too short
    [InlineData("abcd")]   // too long
    [InlineData("ab1")]    // not all letters
    public void Money_rejects_bad_currency_code(string currency)
        => Assert.Throws<ArgumentException>(() => Money.Create(10m, currency));

    [Fact]
    public void Money_has_value_equality()
        => Assert.Equal(Money.Create(10m, "USD"), Money.Create(10m, "usd"));

    [Fact]
    public void CourseTitle_trims_value()
        => Assert.Equal("Hello", CourseTitle.Create("  Hello  ").Value);

    [Fact]
    public void CourseTitle_rejects_blank()
        => Assert.Throws<ArgumentException>(() => CourseTitle.Create("   "));

    [Fact]
    public void CourseTitle_rejects_over_200_chars()
        => Assert.Throws<ArgumentException>(() => CourseTitle.Create(new string('a', 201)));

    [Fact]
    public void Email_trims_value()
        => Assert.Equal("a@b.com", Email.Create("  a@b.com ").Value);

    [Theory]
    [InlineData("no-at-symbol")]
    [InlineData("   ")]
    public void Email_rejects_invalid(string value)
        => Assert.Throws<ArgumentException>(() => Email.Create(value));
}
