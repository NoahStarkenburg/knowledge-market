# The resource group that holds the application.
resource "azurerm_resource_group" "app" {
  name     = "${var.prefix}-rg"
  location = var.location
  tags     = var.tags
}

# Some names must be unique across ALL of Azure, because they become DNS names
# such as <name>.vault.azure.net. Those get this short random suffix. It is
# generated once and kept in state, so names stay the same on every apply.
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

locals {
  suffix = random_string.suffix.result

  # Storage account and registry names allow lowercase letters and digits only.
  compact_prefix = replace(var.prefix, "-", "")
}
