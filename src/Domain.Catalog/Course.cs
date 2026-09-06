using System.Data.SqlTypes;
using Shared.Kernel;

namespace Domain.Catalog;

public enum CourseStatus { Draft = 0, Published = 1 }//
public sealed class Course
{
    public Guid Id { get; set; }
    public CourseTitle Title { get; private set; }
    public string? Description { get; private set; }
    public Money Price { get; private set;}
    public CourseStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? PublishedAt { get; private set; }
    public DateTimeOffset? DeletedAt { get; private set; }

    public Guid CreatedById { get; private set; }
    public string[] Tags { get; private set; } = [];
    public Guid? ThumbnailFileId { get; private set; }
    public Guid? IntroVideoFileId { get; private set; }
    /// <summary>
    /// /
    /// </summary>
    private Course() { }
    //
    private Course(Guid id, CourseTitle title, string? description, Money price, Guid createdById)
    {
        Id = id;
        Title = title;
        Description = description;
        Price = price;
        CreatedAt = DateTimeOffset.UtcNow;
        PublishedAt = null;
        CreatedById = createdById;
    }

    public static Course Create(string title, string? description, decimal amount, string currency, Guid createdById)
    {
        var t = CourseTitle.Create(title);
        var p = Money.Create(amount, currency);
        return new Course(Guid.NewGuid(), t, description, p, createdById);
    }

    public void Publish()
    {
        if (Status == CourseStatus.Published)
        {
            throw new InvalidOperationException("Course already published");
        }
        Status = CourseStatus.Published;
        PublishedAt = DateTimeOffset.UtcNow;
    }

    // In Domain.Catalog/Course.cs
    public void Rename(string newTitle)
    {
        if (Status == CourseStatus.Published)
            throw new InvalidOperationException("Published courses cannot be renamed.");
        CourseTitle title = CourseTitle.Create(newTitle);
        Title = title;
    }

    public void ChangePrice(decimal amount, string currency)
    {
        if (Status == CourseStatus.Published)
            throw new InvalidOperationException("Published courses cannot be repriced.");
        Money money = Money.Create(amount, currency);
        Price = money;
    }

    public void UpdateDescription(string? description) => Description = description;

    public void SetTags(IEnumerable<string> tags)
    {
        Tags = tags
            .Select(t => t.Trim().ToLowerInvariant())
            .Where(t => t.Length > 0 && t.Length <= 50)
            .Distinct()
            .Take(10)
            .ToArray();
    }

    public void SetThumbnail(Guid? fileId) => ThumbnailFileId = fileId;
    public void SetIntroVideo(Guid? fileId) => IntroVideoFileId = fileId;

    public void DeleteCourse()
    {
        DeletedAt = DateTimeOffset.UtcNow;
    }

}
