# Email: Azure Communication Services, signed into with the API's managed
# identity. No SMTP password or access key exists anywhere.
#
#   Email Communication Service   owns the sender domains
#     AzureManagedDomain          an Azure-provided address, DoNotReply@<id>.azurecomm.net,
#                                 usable immediately with no DNS setup. A custom domain
#                                 (with SPF, DKIM and DMARC) replaces it later.
#   Communication Service         the endpoint the API sends through, linked to that domain
#
# Cost is per message (a fraction of a cent), so there is no switch to turn it off.

resource "azurerm_email_communication_service" "main" {
  name                = "${var.prefix}-email"
  resource_group_name = azurerm_resource_group.app.name
  data_location       = "United States"
  tags                = var.tags
}

resource "azurerm_email_communication_service_domain" "azure_managed" {
  name              = "AzureManagedDomain"
  email_service_id  = azurerm_email_communication_service.main.id
  domain_management = "AzureManaged"
  tags              = var.tags
}

# Its name becomes part of a public host name (<name>.<geo>.communication.azure.com),
# so it gets the random suffix.
resource "azurerm_communication_service" "main" {
  name                = "${var.prefix}-acs-${local.suffix}"
  resource_group_name = azurerm_resource_group.app.name
  data_location       = "United States"
  tags                = var.tags
}

resource "azurerm_communication_service_email_domain_association" "main" {
  communication_service_id = azurerm_communication_service.main.id
  email_service_domain_id  = azurerm_email_communication_service_domain.azure_managed.id
}

# Lets the API's identity send through this Communication Service, and nothing else.
resource "azurerm_role_assignment" "api_email" {
  scope                = azurerm_communication_service.main.id
  role_definition_name = "Communication and Email Service Owner"
  principal_id         = azurerm_user_assigned_identity.api.principal_id
  principal_type       = "ServicePrincipal"
}
