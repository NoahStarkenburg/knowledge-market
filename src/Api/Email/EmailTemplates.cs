namespace Api.Email;

public static class EmailTemplates
{
    public static string Welcome(string email) => $"""
        <h2>Welcome to KnowledgeMarket!</h2>
        <p>Your account has been created for <strong>{email}</strong>.</p>
        <p>Start browsing courses and learning today.</p>
        """;

    public static string PurchaseReceipt(string courseTitle, decimal amount, string currency) => $"""
        <h2>Purchase Confirmed</h2>
        <p>Thank you for purchasing <strong>{courseTitle}</strong>.</p>
        <p>Amount charged: <strong>{amount:F2} {currency.ToUpperInvariant()}</strong></p>
        <p>You now have full access to the course. Happy learning!</p>
        """;

    public static string PasswordReset(string resetUrl) => $"""
        <h2>Reset your password</h2>
        <p>Click below to choose a new password. This link expires in 1 hour.</p>
        <p style="margin:24px 0">
          <a href="{resetUrl}" style="background:#030213;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
            Reset Password
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
        """;

    public static string VerifyEmail(string verifyUrl) => $"""
        <h2>Verify your email address</h2>
        <p>Thanks for signing up! Click the button below to confirm your email address.</p>
        <p style="margin:24px 0">
          <a href="{verifyUrl}"
             style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
            Verify Email
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
        """;
}
