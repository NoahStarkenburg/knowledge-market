# Values Terraform prints after an apply, and that other tooling (the deploy
# workflow, for one) can read with `terraform output`.

output "resource_group_name" {
  description = "Name of the resource group holding the application."
  value       = azurerm_resource_group.app.name
}

output "public_url" {
  description = "The site's address."
  value       = local.public_origin
}

output "container_registry" {
  description = "Registry to push images to: docker push <this>/knowledgemarket-api:<tag>."
  value       = azurerm_container_registry.main.login_server
}

output "api_app_name" {
  description = "Container app running the API, for az containerapp commands."
  value       = azurerm_container_app.api.name
}

output "web_app_name" {
  description = "Container app running nginx and the Angular files."
  value       = azurerm_container_app.web.name
}

output "key_vault_name" {
  description = "Key Vault holding the API's secrets. Admin password: az keyvault secret show --vault-name <this> --name admin-password --query value -o tsv"
  value       = azurerm_key_vault.main.name
}

output "storage_account_name" {
  description = "Storage account holding uploads and lesson text."
  value       = azurerm_storage_account.files.name
}

output "sql_server_fqdn" {
  description = "Azure SQL server host name."
  value       = azurerm_mssql_server.main.fully_qualified_domain_name
}
