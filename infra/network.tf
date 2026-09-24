# The private network the apps and the database's private endpoint live in.
#
#   10.0.0.0/16      knowledgemarket-vnet
#     10.0.0.0/24      apps                the Container Apps environment
#     10.0.1.0/24      private-endpoints   the database's private address
#
# Being inside the network does not make anything public. The web app is
# reachable from the internet because its ingress says so (apps.tf); the API
# and the database are not.

resource "azurerm_virtual_network" "main" {
  name                = "${var.prefix}-vnet"
  location            = azurerm_resource_group.app.location
  resource_group_name = azurerm_resource_group.app.name
  address_space       = ["10.0.0.0/16"]
  tags                = var.tags
}

resource "azurerm_subnet" "apps" {
  name                 = "apps"
  resource_group_name  = azurerm_resource_group.app.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.0.0/24"]

  # Hands the subnet over to Container Apps, which runs its own infrastructure
  # in it. A workload-profiles environment requires the delegation.
  delegation {
    name = "container-apps"

    service_delegation {
      name    = "Microsoft.App/environments"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "private_endpoints" {
  name                 = "private-endpoints"
  resource_group_name  = azurerm_resource_group.app.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.1.0/24"]
}
