# Which Terraform, and which providers, this configuration is written for.
#
# A PROVIDER is the plugin that knows how to talk to one platform's API.
# `azurerm` turns "resource azurerm_container_app ..." into Azure API calls.
#
# Versions are constrained, not left open:
#   ~> 5.5   means ">= 5.5.0 and < 6.0.0" — minor and patch updates, never a new
#            major version, because major versions are where settings get renamed
#            and removed.
# The exact versions actually used are then recorded in .terraform.lock.hcl,
# which IS committed. Same idea as package-lock.json: everyone, including CI,
# runs identical provider builds until someone deliberately upgrades.

terraform {
  required_version = ">= 1.14.0, < 2.0.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.5"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
  }
}
