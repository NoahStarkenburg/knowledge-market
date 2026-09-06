namespace Domain.Orders
{
    public enum SubscriptionStatus
    {
        Active = 0,
        Inactive = 1,
        PastDue = 2,
        Canceled = 3,
    }

    public sealed class Subscription
    {
        public Guid Id { get; private set; }
        public Guid BuyerId { get; private set; }           // subscriber
        public Guid CoursesOwnerId { get; private set; }    // creator/instructor
        public SubscriptionStatus Status { get; private set; }

        public DateTimeOffset CurrentPeriodStart { get; private set; }
        public DateTimeOffset CurrentPeriodEnd { get; private set; }

        public string? StripeSubscriptionId { get; private set; }

        // EF needs this
        private Subscription() { }

        // Your "happy path" ctor
        public Subscription(Guid id, Guid buyerId, Guid coursesOwnerId)
        {
            Id = id;
            BuyerId = buyerId;
            CoursesOwnerId = coursesOwnerId;
            Status = SubscriptionStatus.Active;

            CurrentPeriodStart = DateTimeOffset.UtcNow;
            CurrentPeriodEnd = CurrentPeriodStart.AddMonths(1);
        }

        public bool IsActive(DateTimeOffset now) =>
            Status == SubscriptionStatus.Active && CurrentPeriodEnd > now;

        public void SetStripeSubscriptionId(string stripeSubId)
        {
            StripeSubscriptionId = stripeSubId;
        }

        public void MarkActive()
        {
            Status = SubscriptionStatus.Active;
        }

        public void MarkInactive()
        {
            Status = SubscriptionStatus.Inactive;
        }

        public void MarkPastDue()
        {
            Status = SubscriptionStatus.PastDue;
        }

        public void UpdatePeriod(DateTimeOffset periodStart, DateTimeOffset periodEnd)
        {
            CurrentPeriodStart = periodStart;
            CurrentPeriodEnd = periodEnd;
        }

        public void ExtendOneMonth()
        {
            CurrentPeriodStart = CurrentPeriodEnd;
            CurrentPeriodEnd = CurrentPeriodEnd.AddMonths(1);
        }

        public void Cancel()
        {
            Status = SubscriptionStatus.Canceled;
        }
    }
}
