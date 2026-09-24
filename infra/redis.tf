# Azure Managed Redis for the API's cache. Optional (var.enable_redis): the API
# treats a missing or unreachable cache as a miss and reads from SQL.

resource "azurerm_managed_redis" "main" {
  count               = var.enable_redis ? 1 : 0
  name                = "${var.prefix}-redis-${local.suffix}"
  location            = azurerm_resource_group.app.location
  resource_group_name = azurerm_resource_group.app.name
  sku_name            = "Balanced_B0"

  # One node instead of a replicated pair, at about half the price. Paying for
  # high availability makes little sense for a cache the app can run without.
  high_availability_enabled = false

  default_database {
    # Entra ID sign-in only, so there is no access key to leak.
    access_keys_authentication_enabled = false
  }

  tags = var.tags
}

# Lets the API's identity sign in and use the cache.
resource "azurerm_managed_redis_access_policy_assignment" "api" {
  count            = var.enable_redis ? 1 : 0
  managed_redis_id = azurerm_managed_redis.main[0].id
  object_id        = azurerm_user_assigned_identity.api.principal_id
}
