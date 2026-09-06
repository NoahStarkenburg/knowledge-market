namespace Shared.Kernel;

public sealed class Money : IEquatable<Money>
{
    // EF Core calls this, then sets properties via reflection.
    // The null-forgiving operator tells the compiler "it will be set."
    private Money() { Currency = null!; }

    private Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    public decimal Amount { get; private set; }       // value type: default 0
    public string Currency { get; private set; }     // non-null after materialization/factory

    public static Money Create(decimal amount, string currency)
    {
        if (amount < 0m) throw new ArgumentOutOfRangeException(nameof(amount));
        if (string.IsNullOrWhiteSpace(currency)) throw new ArgumentException(nameof(currency));

        var c = currency.Trim().ToLowerInvariant();
        if (c.Length != 3 || !c.All(char.IsLetter))
            throw new ArgumentException("Currency must be a 3-letter code.", nameof(currency));

        var rounded = decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
        return new Money(rounded, c);
    }

    // Value semantics
    public bool Equals(Money? other) =>
        other is not null &&
        Amount == other.Amount &&
        Currency == other.Currency;

    public override bool Equals(object? obj) => obj is Money m && Equals(m);

    public override int GetHashCode() => HashCode.Combine(Amount, Currency);

    public static bool operator ==(Money? left, Money? right) => Equals(left, right);
    public static bool operator !=(Money? left, Money? right) => !Equals(left, right);

    public override string ToString() => $"{Currency} {Amount:0.00}";
}
