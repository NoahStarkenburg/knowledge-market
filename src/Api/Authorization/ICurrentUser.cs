namespace Api.Auth
{
    public interface ICurrentUser
    {
        bool IsAuthenticated { get; }
        string? Email { get; }
        Task<Guid> GetUserIdAsync(CancellationToken ct = default);
        Task<Guid> GetRequiredUserIdAsync(CancellationToken ct = default);
    }
}
