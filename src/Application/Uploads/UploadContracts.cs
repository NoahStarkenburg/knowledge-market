namespace Application.Uploads;

public sealed record PresignRequest(string FileName, string ContentType);
public sealed record PresignResponse(string Mode, string? UploadUrl, string? Key);
public sealed record ConfirmRequest(string Key, string FileName, string ContentType);
