# Values Terraform prints after an apply, and that other tooling (the deploy
# workflow, for one) can read with `terraform output`.

output "resource_group_name" {
  description = "Name of the resource group holding the application."
  value       = azurerm_resource_group.app.name
}
