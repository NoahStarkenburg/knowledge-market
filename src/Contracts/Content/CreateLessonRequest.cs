using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Contracts.Content
{
    public sealed record CreateLessonRequest(string Title, bool IsFreePreview, string Body);
    public sealed record LessonListItem(Guid Id, string Title, bool IsFreePreview, int SortOrder, DateTimeOffset CreatedAt);
    public sealed record LessonBodyDto(Guid Id, string Title, bool IsFreePreview, string? Body);
    
   
}
