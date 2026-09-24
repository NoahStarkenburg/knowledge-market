# Azure SQL: one logical server and one database, "km", with a schema per
# bounded context, the same layout as the local SQL Server container.

resource "azurerm_mssql_server" "main" {
  name                = "${var.prefix}-sql-${local.suffix}"
  location            = azurerm_resource_group.app.location
  resource_group_name = azurerm_resource_group.app.name
  version             = "12.0"
  minimum_tls_version = "1.2"

  public_network_access_enabled = !var.sql_private_endpoint

  # Entra ID sign-in only. The server has no SQL username or password at all.
  #
  # The admin is the API's own identity. The API runs EF Core migrations at
  # startup, so it creates and alters tables and has to own the schema anyway.
  # A narrower database user would need a T-SQL statement run by an admin over
  # a network nothing outside the VNet can reach. Tightening this belongs with
  # moving migrations into their own deploy step.
  azuread_administrator {
    login_username              = azurerm_user_assigned_identity.api.name
    object_id                   = azurerm_user_assigned_identity.api.principal_id
    azuread_authentication_only = true
  }

  tags = var.tags
}

# The database, on the Azure SQL free offer: each month, 100,000 vCore-seconds
# of compute and 32 GB of storage at no charge.
#
# Created with azapi because azurerm has no attribute for the free offer. The
# body below is the Azure Resource Manager API's own format, the same JSON the
# portal sends.
#
# Serverless: the database pauses after an hour without connections and resumes
# on the next one, which takes up to a minute. While paused it uses no compute.
# With freeLimitExhaustionBehavior = AutoPause, running out of free compute
# pauses it until the next month instead of billing. The free offer only allows
# the default pause delay with that setting, so autoPauseDelay is not set.
resource "azapi_resource" "database" {
  type      = "Microsoft.Sql/servers/databases@2023-08-01"
  name      = "km"
  parent_id = azurerm_mssql_server.main.id
  location  = azurerm_resource_group.app.location
  tags      = var.tags

  body = {
    sku = {
      name     = "GP_S_Gen5"
      tier     = "GeneralPurpose"
      family   = "Gen5"
      capacity = 2
    }
    properties = {
      useFreeLimit                     = true
      freeLimitExhaustionBehavior      = "AutoPause"
      minCapacity                      = 0.5
      maxSizeBytes                     = 34359738368
      requestedBackupStorageRedundancy = "Local"
    }
  }

  # Terraform refuses any plan that would delete this database, including
  # `terraform destroy`. To tear the environment down on purpose, remove this
  # block first.
  lifecycle {
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# How the API reaches the server
# ---------------------------------------------------------------------------
# With the private endpoint, the server gets an address inside the VNet and its
# public endpoint is switched off. The private DNS zone makes the normal name,
# <server>.database.windows.net, resolve to that private address for anything
# in the VNet, so the connection string does not change.

resource "azurerm_private_dns_zone" "sql" {
  count               = var.sql_private_endpoint ? 1 : 0
  name                = "privatelink.database.windows.net"
  resource_group_name = azurerm_resource_group.app.name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "sql" {
  count               = var.sql_private_endpoint ? 1 : 0
  name                = "sql"
  private_dns_zone_id = azurerm_private_dns_zone.sql[0].id
  virtual_network_id  = azurerm_virtual_network.main.id
  tags                = var.tags
}

resource "azurerm_private_endpoint" "sql" {
  count               = var.sql_private_endpoint ? 1 : 0
  name                = "${var.prefix}-sql-pe"
  location            = azurerm_resource_group.app.location
  resource_group_name = azurerm_resource_group.app.name
  subnet_id           = azurerm_subnet.private_endpoints.id

  private_service_connection {
    name                           = "sql"
    private_connection_resource_id = azurerm_mssql_server.main.id
    subresource_names              = ["sqlServer"]
    is_manual_connection           = false
  }

  # Registers the endpoint's address in the zone above automatically.
  private_dns_zone_group {
    name                 = "sql"
    private_dns_zone_ids = [azurerm_private_dns_zone.sql[0].id]
  }

  tags = var.tags
}

# The cheaper alternative. 0.0.0.0 is a special value meaning "any Azure
# service", which includes other customers' services, so the Entra-only sign-in
# above is what actually keeps them out.
resource "azurerm_mssql_firewall_rule" "azure_services" {
  count            = var.sql_private_endpoint ? 0 : 1
  name             = "AllowAzureServices"
  server_id        = azurerm_mssql_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}
