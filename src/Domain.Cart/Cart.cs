using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Cart
{
    public sealed class Cart
    {
        public Guid Id { get; private set; }
        public Guid BuyerId { get; private set; }
        public DateTimeOffset CreatedAt { get; private set; }
        public DateTimeOffset UpdatedAt { get; private set; }

        private readonly List<CartItem> _items = new();
        public IReadOnlyList<CartItem> Items => _items;

        private Cart() { }

        private Cart(Guid id, Guid buyerId)
        {
            Id = id;
            BuyerId = buyerId;
            CreatedAt = DateTimeOffset.UtcNow;
            UpdatedAt = DateTimeOffset.UtcNow;
        }
        public static Cart CreateCart(Guid buyerId)
        {
            Cart cart = new Cart(Guid.NewGuid(), buyerId);
            return cart;
        }

        public void AddItem(Guid courseId)
        {
            if (_items.Any(i => i.CourseId == courseId)) return;

            _items.Add(CartItem.Register(Id, courseId));
            UpdatedAt = DateTimeOffset.UtcNow;
        }

        public void RemoveItem(Guid courseId)
        {
            var removed = _items.RemoveAll(i => i.CourseId == courseId);
            if (removed > 0) 
                UpdatedAt = DateTimeOffset.UtcNow;  
        }

        public void Clear() => _items.Clear();
    }
}
