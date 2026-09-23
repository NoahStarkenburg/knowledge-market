# Key Vault holds the API's secrets. The container app references them by URL
# and Container Apps fetches them with the API's identity, so no secret value
# appears in the app's configuration, in this code, or in Terraform state.

data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  name                = "${var.prefix}-${local.suffix}"
  location            = azurerm_resource_group.app.location
  resource_group_name = azurerm_resource_group.app.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"

  # Access is granted with Azure roles, like everything else here, rather than
  # the vault's older, separate list of access policies.
  rbac_authorization_enabled = true

  # A deleted vault can be recovered for 7 days (the minimum). Purge protection
  # would additionally stop anyone deleting it for good during that time, which
  # also blocks rebuilding an environment under the same name. Off for now;
  # turn it on once the vault holds something that cannot be regenerated.
  soft_delete_retention_days = 7
  purge_protection_enabled   = false

  tags = var.tags
}

# Whoever runs Terraform writes the generated secrets below, and can read them
# back with the Azure CLI (the admin password, for example).
resource "azurerm_role_assignment" "deployer_key_vault" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

# Read-only: the API can read secret values, not create, change or delete them.
resource "azurerm_role_assignment" "api_key_vault" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.api.principal_id
  principal_type       = "ServicePrincipal"
}

# ---------------------------------------------------------------------------
# Secrets nobody types or sees
# ---------------------------------------------------------------------------
# An `ephemeral` resource exists only while a plan or apply runs: the value is
# generated, used, and forgotten, and never written to the state file.
#
# `value_wo` (write-only) is the other half. Terraform sends the value to Key
# Vault without recording it, and records `value_wo_version` instead. A new
# value is sent only when that number changes, so to rotate a secret, bump it.

ephemeral "random_password" "jwt_signing_key" {
  length  = 64
  special = false
}

resource "azurerm_key_vault_secret" "jwt_signing_key" {
  name             = "jwt-signing-key"
  key_vault_id     = azurerm_key_vault.main.id
  value_wo         = ephemeral.random_password.jwt_signing_key.result
  value_wo_version = 1

  depends_on = [azurerm_role_assignment.deployer_key_vault]
}

ephemeral "random_password" "admin_password" {
  length      = 24
  min_upper   = 1
  min_lower   = 1
  min_numeric = 1
  min_special = 1
}

resource "azurerm_key_vault_secret" "admin_password" {
  name             = "admin-password"
  key_vault_id     = azurerm_key_vault.main.id
  value_wo         = ephemeral.random_password.admin_password.result
  value_wo_version = 1

  depends_on = [azurerm_role_assignment.deployer_key_vault]
}
