# Creates the storage account that holds Terraform's state. Run ONCE, by hand.
#
#     pwsh ./infra/bootstrap/create-state-storage.ps1
#
# Why this is a script and not Terraform
# --------------------------------------
# Terraform records everything it manages in a STATE FILE, and for anything
# beyond a solo experiment that file lives in shared remote storage, so that
# your laptop and GitHub Actions work from the same record. That storage has to
# exist before Terraform can use it — Terraform cannot store its state in a
# place it has not created yet. This is the chicken-and-egg step every Terraform
# project has. It is done once, with the plain Azure CLI, and never touched again.
#
# Why a separate resource group
# -----------------------------
# The app lives in knowledgemarket-rg. The state lives here, in
# knowledgemarket-tfstate-rg. If both were in one group, `terraform destroy`
# could delete the very file that records what it is destroying.
#
# Safe to re-run: every step either creates the thing or confirms it exists.

param(
    [string]$Location       = "centralus",
    [string]$ResourceGroup  = "knowledgemarket-tfstate-rg",
    # Storage account names are global across ALL of Azure, 3-24 lowercase
    # letters and digits. Hence the random suffix.
    [string]$StorageAccount = "kmtfstatepnwppm",
    [string]$Container      = "tfstate"
)

$ErrorActionPreference = "Stop"

# The az CLI is a native program, so PowerShell does not throw when it fails.
# Check its exit code after every call, or a failure silently carries on.
function Invoke-Az {
    $output = az @args
    if ($LASTEXITCODE -ne 0) { throw "az $($args -join ' ') failed with exit code $LASTEXITCODE" }
    return $output
}

Write-Host "==> Resource group $ResourceGroup"
Invoke-Az group create --name $ResourceGroup --location $Location `
    --tags project=knowledgemarket purpose=terraform-state --output none

Write-Host "==> Storage account $StorageAccount"
# Every flag here closes a door, and each matters because the state file holds
# secrets in PLAINTEXT — anything Terraform creates with a password or key ends
# up recorded in it.
#   --allow-blob-public-access false   nothing in it can ever be made public
#   --allow-shared-key-access false    no account keys: every read and write must
#                                      be an Entra ID login with an RBAC role,
#                                      so access is per-person and audited
#   --min-tls-version / --https-only   no unencrypted connections
#   Standard_LRS                       cheapest redundancy; the state is small
#                                      and versioning below covers mistakes
Invoke-Az storage account create `
    --name $StorageAccount --resource-group $ResourceGroup --location $Location `
    --sku Standard_LRS --kind StorageV2 `
    --min-tls-version TLS1_2 --https-only true `
    --allow-blob-public-access false `
    --allow-shared-key-access false `
    --tags project=knowledgemarket purpose=terraform-state --output none

Write-Host "==> Versioning and soft delete"
# A corrupted or wrongly-overwritten state file is one of the worst Terraform
# failures: Terraform forgets what it owns. Versioning keeps every previous copy
# of the file; soft delete keeps a deleted file recoverable for 30 days.
Invoke-Az storage account blob-service-properties update `
    --account-name $StorageAccount --resource-group $ResourceGroup `
    --enable-versioning true `
    --enable-delete-retention true --delete-retention-days 30 `
    --enable-container-delete-retention true --container-delete-retention-days 30 `
    --output none

Write-Host "==> Access for the signed-in user"
# With shared keys disabled, access comes only from a role assignment. This one
# lets YOU read and write the state. GitHub Actions gets its own later, scoped the
# same way. "Data Contributor" is the data-plane role: it can read and write
# blobs but cannot change the account's settings.
$me    = Invoke-Az ad signed-in-user show --query id --output tsv
$scope = Invoke-Az storage account show --name $StorageAccount --resource-group $ResourceGroup --query id --output tsv
# Fetch the matching assignments' ids and count them here, rather than asking az
# for `length(@)`. On Windows `az` is a batch file, so its arguments are re-parsed
# by cmd.exe, which treats parentheses as its own syntax and fails with
# "--output was unexpected at this time".
#
# The Where-Object filter matters: with no results the call returns $null, and
# @($null).Count is 1 in PowerShell, not 0 — the script would wrongly conclude
# the role already exists and skip creating it.
$existing = @(Invoke-Az role assignment list --assignee $me --scope $scope `
    --role "Storage Blob Data Contributor" --query "[].id" --output tsv |
    Where-Object { $_ })
if ($existing.Count -eq 0) {
    Invoke-Az role assignment create --assignee-object-id $me --assignee-principal-type User `
        --role "Storage Blob Data Contributor" --scope $scope --output none
}

Write-Host "==> Container $Container (retries while the new role propagates)"
# A new role assignment takes a few minutes to take effect everywhere, so the
# first attempts can fail with "not authorized" even though nothing is wrong.
#
# The retry loop relaxes $ErrorActionPreference for this one call. In Windows
# PowerShell 5.1, redirecting a native command's stderr while it is "Stop" turns
# the first failed attempt into a terminating error, so the loop would never retry.
$created = $false
for ($attempt = 1; $attempt -le 20 -and -not $created; $attempt++) {
    $ErrorActionPreference = "Continue"
    az storage container create --name $Container --account-name $StorageAccount `
        --auth-mode login --output none 2>$null
    $exit = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    if ($exit -eq 0) { $created = $true }
    else { Write-Host "    waiting for access to propagate ($attempt/20)..."; Start-Sleep -Seconds 15 }
}
if (-not $created) { throw "Could not create the container. Wait a few minutes and re-run." }

Write-Host "==> Delete lock"
# Stops anyone — including you on a bad day — deleting the state resource group
# by accident. To remove it deliberately:
#     az lock delete --name do-not-delete-terraform-state --resource-group $ResourceGroup
Invoke-Az lock create --name do-not-delete-terraform-state --lock-type CanNotDelete `
    --resource-group $ResourceGroup `
    --notes "Holds Terraform state for knowledgemarket. Deleting it makes Terraform forget what it manages." `
    --output none

Write-Host ""
Write-Host "Done. These values belong in infra/backend.tf:"
Write-Host "  resource_group_name  = `"$ResourceGroup`""
Write-Host "  storage_account_name = `"$StorageAccount`""
Write-Host "  container_name       = `"$Container`""
