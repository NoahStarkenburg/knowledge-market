# Where Terraform keeps its STATE — the record of every resource it manages.
#
# Without a backend block, state is a terraform.tfstate file in this folder.
# That breaks as soon as a second machine is involved: your laptop and GitHub
# Actions would each have their own copy, each believing different things exist.
#
# The azurerm backend stores it as a blob in the storage account created by
# infra/bootstrap/create-state-storage.ps1, and gives two things a local file
# cannot:
#   - one shared record for every machine that runs Terraform
#   - LOCKING: during a plan or apply Terraform takes a lease on the blob, so
#     two applies at once cannot both write and corrupt it
#
# None of these values are secrets. They say WHERE the state is; getting in
# still requires an Entra ID login holding a role on that storage account.

terraform {
  backend "azurerm" {
    resource_group_name  = "knowledgemarket-tfstate-rg"
    storage_account_name = "kmtfstatepnwppm"
    container_name       = "tfstate"

    # One state file per environment. Staging would be staging.terraform.tfstate.
    key = "prod.terraform.tfstate"

    # Log in as you (or as GitHub's OIDC identity), not with a storage account
    # key. Shared keys are disabled on that account, so this is the only way in.
    use_azuread_auth = true
  }
}
