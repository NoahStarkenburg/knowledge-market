namespace UnitTests;

public class UnitTest1
{
    [Fact]
    public void TwoPlusTwo_ShouldEqualFour()
    {
        // arrange
        var a = 2;
        var b = 2;

        // act
        var result = a + b;

        // assert
        Assert.Equal(4, result);
    }
}
