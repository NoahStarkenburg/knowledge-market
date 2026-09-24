# The two containers, and the environment they share.
#
#   internet --HTTPS--> web (nginx)  external ingress, serves the Angular files
#                        |
#                        | http://<api internal name>/api/...
#                        v
#                       api (.NET)   internal ingress: no public address at all
#
# The same images run under docker compose; only these settings differ.

resource "azurerm_container_app_environment" "main" {
  name                       = "${var.prefix}-env"
  location                   = azurerm_resource_group.app.location
  resource_group_name        = azurerm_resource_group.app.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  logs_destination           = "log-analytics"

  # Runs inside our VNet, which is what lets the API reach the database's
  # private endpoint.
  infrastructure_subnet_id = azurerm_subnet.apps.id

  # Container Apps keeps its own load balancer and addresses in a separate
  # resource group it manages. Named here rather than left to Azure's default.
  infrastructure_resource_group_name = "${var.prefix}-env-infra-rg"

  # Consumption: billed per second of use, with a monthly free allowance.
  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }

  tags = var.tags
}

locals {
  # The address people browse to. Front Door replaces it in a later change.
  public_origin = "https://${var.prefix}-web.${azurerm_container_app_environment.main.default_domain}"

  # Each app's FIRST revision runs the image with this tag, pushed by hand on
  # the first deploy. After that the deploy pipeline rolls out new images and
  # Terraform leaves the image alone (ignore_changes below). Otherwise every
  # `terraform apply` would roll production back to this tag.
  initial_image_tag = "initial"

  # No password: "Active Directory Managed Identity" makes SqlClient sign in as
  # the identity whose client ID is given as User Id.
  sql_connection_string = join(";", [
    "Server=tcp:${azurerm_mssql_server.main.fully_qualified_domain_name},1433",
    "Database=${azapi_resource.database.name}",
    "Authentication=Active Directory Managed Identity",
    "User Id=${azurerm_user_assigned_identity.api.client_id}",
    "Encrypt=True",
  ])
}

# ---------------------------------------------------------------------------
# api
# ---------------------------------------------------------------------------
resource "azurerm_container_app" "api" {
  name                         = "${var.prefix}-api"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.app.name
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.api.id]
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.api.id
  }

  # Key Vault references. Container Apps reads each value as the API's identity
  # and re-reads it periodically, so a rotated secret reaches new revisions
  # without a Terraform change.
  secret {
    name                = "jwt-signing-key"
    key_vault_secret_id = azurerm_key_vault_secret.jwt_signing_key.versionless_id
    identity            = azurerm_user_assigned_identity.api.id
  }

  secret {
    name                = "admin-password"
    key_vault_secret_id = azurerm_key_vault_secret.admin_password.versionless_id
    identity            = azurerm_user_assigned_identity.api.id
  }

  # Not a password, but it does let anyone send telemetry into our workspace.
  secret {
    name  = "appinsights-connection-string"
    value = azurerm_application_insights.main.connection_string
  }

  ingress {
    # Internal: reachable only from inside the environment, which means nginx.
    external_enabled = false
    target_port      = 8080

    # nginx calls the API over plain HTTP inside the environment. Without this,
    # Container Apps answers that with a redirect to HTTPS, which nginx would
    # pass straight back to the browser.
    allow_insecure_connections = true

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = var.api_min_replicas

    # Never more than one: migrations run at startup, and two replicas starting
    # together would both try to migrate.
    max_replicas = 1

    container {
      name   = "api"
      image  = "${azurerm_container_registry.main.login_server}/knowledgemarket-api:${local.initial_image_tag}"
      cpu    = 0.5
      memory = "1Gi"

      # ASPNETCORE_ENVIRONMENT is not set, so the API runs as Production and
      # ProductionConfigValidator refuses to start if anything below is missing.

      # Which managed identity DefaultAzureCredential uses (storage, Redis).
      env {
        name  = "AZURE_CLIENT_ID"
        value = azurerm_user_assigned_identity.api.client_id
      }
      env {
        name  = "ConnectionStrings__Default"
        value = local.sql_connection_string
      }
      env {
        name        = "Jwt__SigningKey"
        secret_name = "jwt-signing-key"
      }
      env {
        name  = "Admin__Email"
        value = var.admin_email
      }
      env {
        name        = "Admin__Password"
        secret_name = "admin-password"
      }
      # The public address, used to build links in emails and sign-in redirects.
      env {
        name  = "Cors__FrontendOrigin"
        value = local.public_origin
      }
      # Trust nginx's X-Client-* headers. Safe only because nothing but nginx
      # can reach this app (internal ingress).
      env {
        name  = "ForwardedHeaders__Enabled"
        value = "true"
      }
      env {
        name  = "Storage__Provider"
        value = "azureblob"
      }
      env {
        name  = "Storage__AzureBlob__ServiceUri"
        value = azurerm_storage_account.files.primary_blob_endpoint
      }
      # Checkout stays off until the Stripe webhook for the live address exists.
      env {
        name  = "Stripe__Disabled"
        value = "true"
      }
      env {
        name        = "APPLICATIONINSIGHTS_CONNECTION_STRING"
        secret_name = "appinsights-connection-string"
      }
      dynamic "env" {
        for_each = var.enable_redis ? [azurerm_managed_redis.main[0].hostname] : []
        content {
          name  = "Redis__Host"
          value = "${env.value}:10000"
        }
      }

      # Probes: how Container Apps decides the container is healthy.
      #
      # All three use /health, which only proves the process is serving
      # requests. /health/ready also checks SQL, and a readiness probe runs
      # every few seconds forever. Pointed at SQL, it would keep the serverless
      # database awake around the clock and use up its free compute in days.

      # The API starts listening only after migrations finish, so allow time
      # for a paused database to resume first.
      startup_probe {
        transport               = "HTTP"
        path                    = "/health"
        port                    = 8080
        initial_delay           = 10
        interval_seconds        = 15
        failure_count_threshold = 10
      }

      liveness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 8080
      }

      readiness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 8080
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].container[0].image]
  }

  # The first revision pulls its image and reads its secrets as soon as the app
  # is created, so these roles must exist before it.
  depends_on = [
    azurerm_role_assignment.api_acr_pull,
    azurerm_role_assignment.api_key_vault,
    azurerm_role_assignment.api_blob,
    azurerm_managed_redis_access_policy_assignment.api,
  ]

  tags = var.tags
}

# ---------------------------------------------------------------------------
# web
# ---------------------------------------------------------------------------
resource "azurerm_container_app" "web" {
  name                         = "${var.prefix}-web"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.app.name
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.web.id]
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.web.id
  }

  ingress {
    # External: Container Apps gives it a public HTTPS address and certificate.
    external_enabled = true
    target_port      = 8080

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 2

    container {
      name   = "web"
      image  = "${azurerm_container_registry.main.login_server}/knowledgemarket-web:${local.initial_image_tag}"
      cpu    = 0.25
      memory = "0.5Gi"

      # The API's full internal name, not just "knowledgemarket-api". nginx's
      # resolver looks names up exactly as written and ignores the DNS search
      # domains that would complete a short name. It is also the Host header
      # Container Apps routes on (see src/frontend/nginx.conf.template).
      env {
        name  = "API_UPSTREAM"
        value = "${azurerm_container_app.api.ingress[0].fqdn}:80"
      }
      env {
        name  = "API_HOST"
        value = azurerm_container_app.api.ingress[0].fqdn
      }

      # FRONT_DOOR_ID stays empty, so nginx accepts requests from anywhere,
      # until Front Door exists.

      startup_probe {
        transport = "HTTP"
        path      = "/healthz"
        port      = 8080
      }

      liveness_probe {
        transport = "HTTP"
        path      = "/healthz"
        port      = 8080
      }

      readiness_probe {
        transport = "HTTP"
        path      = "/healthz"
        port      = 8080
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].container[0].image]
  }

  depends_on = [azurerm_role_assignment.web_acr_pull]

  tags = var.tags
}
