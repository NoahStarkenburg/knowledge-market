using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Orders
{
    public enum Orderstatus
    {
        Pending = 0,
        Paid = 1,
        Refunded = 2,
    }
}
