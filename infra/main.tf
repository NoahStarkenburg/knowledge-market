# The resource group that holds the application.
#
# It already exists — it was created by hand with the Azure CLI before Terraform
# was chosen. There are two ways to bring an existing resource under Terraform:
#
#   1. delete it and let Terraform recreate it
#   2. IMPORT it: tell Terraform "this real resource is the one this code block
#      describes", so Terraform records it in state without touching it
#
# Real projects almost always need option 2 at some point, because infrastructure
# rarely starts from nothing. The `import` block below does it declaratively:
# `terraform plan` shows "1 to import", and `terraform apply` records it.
#
# After the first successful apply the import block has done its job. Leaving it
# in is harmless — Terraform ignores an import whose resource is already in state.

data "azurerm_subscription" "current" {}

import {
  to = azurerm_resource_group.app
  id = "${data.azurerm_subscription.current.id}/resourceGroups/${var.prefix}-rg"
}

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
