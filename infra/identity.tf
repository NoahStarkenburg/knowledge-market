# Managed identities: identities Azure issues to the apps, with no password or
# key for anyone to copy. Code in the container asks the platform for a token
# (DefaultAzureCredential does this), and each service checks the identity's
# role assignments before answering.
#
# USER-assigned, not system-assigned, because they exist before the apps do.
# Their roles are granted first, so a new app can pull its image and read its
# Key Vault secrets on its very first start.
#
# One identity per app. The web container's identity can only pull images from
# our registry, so if nginx were ever compromised it would hold no path to the
# database, storage or secrets.

resource "azurerm_user_assigned_identity" "api" {
  name                = "${var.prefix}-api-id"
  location            = azurerm_resource_group.app.location
  resource_group_name = azurerm_resource_group.app.name
  tags                = var.tags
}

resource "azurerm_user_assigned_identity" "web" {
  name                = "${var.prefix}-web-id"
  location            = azurerm_resource_group.app.location
  resource_group_name = azurerm_resource_group.app.name
  tags                = var.tags
}
