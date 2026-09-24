# The private registry the container images are pushed to and pulled from.

resource "azurerm_container_registry" "main" {
  name                = "${local.compact_prefix}acr${local.suffix}"
  location            = azurerm_resource_group.app.location
  resource_group_name = azurerm_resource_group.app.name
  sku                 = "Basic"

  # The admin user is a shared username and password for the whole registry.
  # Off: the apps pull as their managed identities, and people and CI push after
  # `az acr login`, which uses their own Entra ID sign-in.
  admin_enabled = false

  tags = var.tags
}

# Pull only. Neither app can push, delete or overwrite an image.
resource "azurerm_role_assignment" "api_acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.api.principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "web_acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.web.principal_id
  principal_type       = "ServicePrincipal"
}
