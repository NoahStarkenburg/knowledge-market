# Blob Storage for uploaded files (assets) and lesson text (content).
#
# The browser uploads and downloads straight to and from this account using
# short-lived SAS links the API signs, so file bytes never pass through nginx or
# the API. See src/Infrastructure/Storage/AzureBlobSasSigner.cs.

resource "azurerm_storage_account" "files" {
  name                     = "${local.compact_prefix}${local.suffix}"
  location                 = azurerm_resource_group.app.location
  resource_group_name      = azurerm_resource_group.app.name
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"

  # No account keys. Every request carries either an Entra ID token or a SAS
  # signed with a user delegation key, which Azure issues only to an identity
  # holding a data role on this account (the API, below).
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true

  # Nothing can be made publicly readable, even by mistake. A file is only
  # reachable through a SAS link the API chose to issue.
  allow_nested_items_to_be_public = false

  blob_properties {
    # An upload is a PUT from the site's origin to this account's origin, so the
    # browser asks first (a CORS preflight) and only sends the file if storage
    # says yes. Allowed: PUT, from the site, with the two headers an upload
    # sends. Downloads are links, <img> and <video> loads, which need no CORS.
    cors_rule {
      allowed_origins    = [local.public_origin]
      allowed_methods    = ["PUT"]
      allowed_headers    = ["content-type", "x-ms-blob-type"]
      exposed_headers    = ["etag"]
      max_age_in_seconds = 3000
    }

    # A deleted blob can be restored for 7 days.
    delete_retention_policy {
      days = 7
    }
  }

  tags = var.tags
}

resource "azurerm_storage_container" "assets" {
  name                  = "assets"
  storage_account_id    = azurerm_storage_account.files.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "content" {
  name                  = "content"
  storage_account_id    = azurerm_storage_account.files.id
  container_access_type = "private"
}

# Read, write and delete blobs, and request the user delegation key that SAS
# links are signed with.
resource "azurerm_role_assignment" "api_blob" {
  scope                = azurerm_storage_account.files.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.api.principal_id
  principal_type       = "ServicePrincipal"
}
