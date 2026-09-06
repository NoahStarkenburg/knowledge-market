using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Catalog
{
    public sealed class CourseTitle
    {
        public string Value { get; }

        private CourseTitle(string value)
        {
            Value = value;
        }
        //
        public static CourseTitle Create(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new ArgumentException("Title is required", nameof(value));
            }
            if (value.Length > 200)
                throw new ArgumentException("Title is too long", nameof(value));

            return new CourseTitle(value.Trim());
        }

        public override string ToString() {  return Value; }
    }
}
