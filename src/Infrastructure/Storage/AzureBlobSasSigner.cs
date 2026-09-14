using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Storage;

// Builds SAS (Shared Access Signature) URLs: a link to one blob, with the permissions and an
// expiry baked into its query string and signed, so the browser can use it without any of our
// credentials. It is Azure's equivalent of an S3 presigned URL. Anyone holding the link can use
// it until it expires, which is why every one is scoped to a single blob and lives minutes.
//
// There are two ways to sign, and which one applies depends on how the client authenticated:
//
//   account key        Azurite locally. The client was built from a connection string, so it
//                      holds the key and signs directly.
//   user delegation    Azure. The client authenticated as a managed identity and holds no key,
//                      so it first asks Entra ID for a temporary "user delegation key" and signs
//                      with that. The storage account can then keep shared keys disabled.
//
// Registered as a singleton because the delegation key is cached and reused across requests.
public sealed class AzureBlobSasSigner(BlobServiceClient service, IConfiguration cfg)
{
    // Signing never needs more than an hour (the longest SAS below), so a key valid for a day
    // and replaced when under two hours remain always outlives every URL signed with it.
    private static readonly TimeSpan KeyLifetime = TimeSpan.FromDays(1);
    private static readonly TimeSpan KeyRefreshMargin = TimeSpan.FromHours(2);

    // A container calls Azurite at "azurite:10000", a name only the compose network can resolve.
    // The browser needs "localhost:10000" instead. The signature covers the account, container,
    // blob and permissions but not the host, so swapping the host afterwards keeps it valid.
    // Empty in Azure, where the blob endpoint is already public.
    private readonly Uri? _publicServiceUri =
        cfg["Storage:AzureBlob:PublicServiceUri"] is { Length: > 0 } u ? new Uri(u) : null;

    private readonly SemaphoreSlim _keyLock = new(1, 1);
    private UserDelegationKey? _delegationKey;

    public async Task<Uri> SignAsync(
        BlobClient blob,
        BlobSasPermissions permissions,
        TimeSpan lifetime,
        Action<BlobSasBuilder>? configure,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var sas = new BlobSasBuilder(permissions, now.Add(lifetime))
        {
            BlobContainerName = blob.BlobContainerName,
            BlobName = blob.Name,
            Resource = "b", // one blob, not the whole container
            // Backdated so a server whose clock runs slightly ahead of ours accepts it immediately.
            StartsOn = now.AddMinutes(-5),
            Protocol = blob.Uri.Scheme == Uri.UriSchemeHttps ? SasProtocol.Https : SasProtocol.HttpsAndHttp,
        };
        configure?.Invoke(sas);

        Uri signed;
        if (blob.CanGenerateSasUri)
        {
            signed = blob.GenerateSasUri(sas);
        }
        else
        {
            var key = await GetDelegationKeyAsync(ct);
            var query = sas.ToSasQueryParameters(key, service.AccountName).ToString();
            signed = new UriBuilder(blob.Uri) { Query = query }.Uri;
        }

        return _publicServiceUri is null
            ? signed
            : new UriBuilder(signed)
            {
                Scheme = _publicServiceUri.Scheme,
                Host = _publicServiceUri.Host,
                Port = _publicServiceUri.Port,
            }.Uri;
    }

    private async Task<UserDelegationKey> GetDelegationKeyAsync(CancellationToken ct)
    {
        if (_delegationKey is { } cached && cached.SignedExpiresOn - DateTimeOffset.UtcNow > KeyRefreshMargin)
            return cached;

        // One refresh at a time; requests that queued behind it reuse the key it fetched.
        await _keyLock.WaitAsync(ct);
        try
        {
            if (_delegationKey is { } fresh && fresh.SignedExpiresOn - DateTimeOffset.UtcNow > KeyRefreshMargin)
                return fresh;

            var now = DateTimeOffset.UtcNow;
            var response = await service.GetUserDelegationKeyAsync(now.AddMinutes(-5), now.Add(KeyLifetime), ct);
            _delegationKey = response.Value;
            return _delegationKey;
        }
        finally
        {
            _keyLock.Release();
        }
    }
}
