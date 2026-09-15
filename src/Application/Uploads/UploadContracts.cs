namespace Application.Uploads;

public sealed record PresignRequest(string FileName, string ContentType);
// Mode is "direct" (PUT UploadUrl with Headers, then confirm Key) or "proxy" (upload through the API).
public sealed record PresignResponse(string Mode, string? UploadUrl, string? Key, IReadOnlyDictionary<string, string>? Headers);
public sealed record ConfirmRequest(string Key, string FileName, string ContentType);
