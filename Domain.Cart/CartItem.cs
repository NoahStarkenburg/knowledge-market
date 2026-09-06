using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Cart
{
    public sealed class CartItem
    {
        public Guid Id { get; private set; }
        public Guid CartId { get; private set; }
        public Guid CourseId { get; private set; }
        public DateTimeOffset AddedAt { get; private set; }

        private CartItem() { }

        private CartItem(Guid cartId, Guid courseId)
        {
            Id = Guid.NewGuid();
            CartId = cartId;
            CourseId = courseId;
            AddedAt = DateTimeOffset.UtcNow;
        }

        public static CartItem Register(Guid cartId, Guid courseId)
        {
            CartItem item = new CartItem(cartId, courseId);
            return item;
        }
    }
}
