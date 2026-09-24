# How the azurerm provider logs in, and which subscription it works in.
#
# There are no credentials in this file, and there never should be.
#   - On your laptop it reuses your `az login` session.
#   - In GitHub Actions it will use OIDC: GitHub proves to Azure which repo and
#     branch the workflow is running from, and receives a token valid for minutes.
#
# The subscription ID is deliberately not written here. The provider reads it
# from the ARM_SUBSCRIPTION_ID environment variable:
#
#     $env:ARM_SUBSCRIPTION_ID = (az account show --query id -o tsv)
#
# A subscription ID is not a secret, but keeping it out of a public repository
# costs nothing and avoids handing anyone a target identifier.

provider "azurerm" {
  # Required, even when empty. Individual resource behaviours (for example what
  # happens to a Key Vault on destroy) are tuned inside this block.
  features {}

  # Talk to storage with Entra ID rather than account keys, matching the
  # locked-down state storage account and the app's own storage.
  storage_use_azuread = true
}

# Logs in the same way as azurerm, and also reads ARM_SUBSCRIPTION_ID.
provider "azapi" {}
