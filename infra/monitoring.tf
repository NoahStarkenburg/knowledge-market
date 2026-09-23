# Where logs and telemetry go.
#
#   Log Analytics          container stdout/stderr and platform events, collected
#                          by Container Apps with no code involved
#   Application Insights   the API's traces and metrics, sent by the Azure
#                          Monitor OpenTelemetry exporter once
#                          APPLICATIONINSIGHTS_CONNECTION_STRING is set (apps.tf)
#
# Both store their data in the same workspace, so one query can join a request
# trace with the container logs around it.

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.prefix}-logs"
  location            = azurerm_resource_group.app.location
  resource_group_name = azurerm_resource_group.app.name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  # A hard stop on ingestion per day. The first 5 GB a month are free, and a
  # container stuck in a crash loop can log more than that in a day.
  daily_quota_gb = 0.5

  tags = var.tags
}

resource "azurerm_application_insights" "main" {
  name                = "${var.prefix}-appi"
  location            = azurerm_resource_group.app.location
  resource_group_name = azurerm_resource_group.app.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
  tags                = var.tags
}
