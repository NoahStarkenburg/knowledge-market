using Domain.Catalog;

namespace UnitTests;

// Pins the Course business rules that will move out of the entity and into
// CourseService during the layered refactor. If a rule silently changes, these break.
public class CourseRulesTests
{
    private static Course NewDraft() =>
        Course.Create("Intro to Testing", "desc", 49.99m, "USD", Guid.NewGuid());

    [Fact]
    public void Create_starts_as_unpublished_draft()
    {
        var course = NewDraft();

        Assert.Equal(CourseStatus.Draft, course.Status);
        Assert.Null(course.PublishedAt);
        Assert.Equal("Intro to Testing", course.Title.Value);
        Assert.Equal(49.99m, course.Price.Amount);
    }

    [Fact]
    public void Publish_sets_status_and_timestamp()
    {
        var course = NewDraft();

        course.Publish();

        Assert.Equal(CourseStatus.Published, course.Status);
        Assert.NotNull(course.PublishedAt);
    }

    [Fact]
    public void Publish_twice_throws()
    {
        var course = NewDraft();
        course.Publish();

        Assert.Throws<InvalidOperationException>(() => course.Publish());
    }

    [Fact]
    public void Rename_allowed_while_draft()
    {
        var course = NewDraft();

        course.Rename("A New Title");

        Assert.Equal("A New Title", course.Title.Value);
    }

    [Fact]
    public void Rename_blocked_after_publish()
    {
        var course = NewDraft();
        course.Publish();

        Assert.Throws<InvalidOperationException>(() => course.Rename("Nope"));
    }

    [Fact]
    public void ChangePrice_allowed_while_draft()
    {
        var course = NewDraft();

        course.ChangePrice(9.99m, "USD");

        Assert.Equal(9.99m, course.Price.Amount);
    }

    [Fact]
    public void ChangePrice_blocked_after_publish()
    {
        var course = NewDraft();
        course.Publish();

        Assert.Throws<InvalidOperationException>(() => course.ChangePrice(1m, "USD"));
    }

    [Fact]
    public void SetTags_trims_lowercases_dedups_and_caps_at_ten()
    {
        var course = NewDraft();

        course.SetTags(new[]
        {
            "  Foo ", "foo", "BAR", "", "   ", new string('x', 51),
            "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"
        });

        Assert.DoesNotContain("", course.Tags);
        Assert.DoesNotContain(new string('x', 51), course.Tags);
        Assert.Contains("foo", course.Tags);
        Assert.Contains("bar", course.Tags);
        Assert.Equal(course.Tags, course.Tags.Distinct());
        Assert.True(course.Tags.Length <= 10);
    }
}
