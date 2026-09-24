# Azure Front Door: the site's public entrance (var.enable_front_door).
#
#   browser --HTTPS--> Front Door edge, the nearest of its locations worldwide
#                        - firewall (WAF) rules: rate limits per client IP
#                        - keeps copies of the Angular files close to visitors
#                      --HTTPS--> web container app (nginx)
#
# The web app keeps its own public address, so two locks make sure traffic
# cannot skip Front Door and its rules:
#   1. the web app accepts connections only from Front Door's IP ranges (apps.tf)
#   2. nginx serves only requests carrying OUR profile's ID in X-Azure-FDID
#      (src/frontend/nginx.conf.template)
# Every Front Door customer shares those IP ranges, so lock 1 alone would still
# let someone else's Front Door through. Lock 2 is what keeps them out.

resource "azurerm_cdn_frontdoor_profile" "main" {
  count               = var.enable_front_door ? 1 : 0
  name                = "${var.prefix}-fd"
  resource_group_name = azurerm_resource_group.app.name
  sku_name            = "Standard_AzureFrontDoor"

  # How long Front Door waits for an answer. A paused database takes up to a
  # minute to resume while the API waits for it; the default of 60 seconds
  # would give up just before.
  response_timeout_seconds = 120

  tags = var.tags
}

# The public host name, <name>-<random>.<zone>.azurefd.net.
resource "azurerm_cdn_frontdoor_endpoint" "main" {
  count                    = var.enable_front_door ? 1 : 0
  name                     = var.prefix
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main[0].id
  tags                     = var.tags
}

resource "azurerm_cdn_frontdoor_origin_group" "web" {
  count                    = var.enable_front_door ? 1 : 0
  name                     = "web"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main[0].id

  load_balancing {}

  # No health_probe block. Probes let Front Door choose between several origins;
  # with only one there is no choice to make, and Microsoft recommends turning
  # them off rather than sending the extra traffic.
}

resource "azurerm_cdn_frontdoor_origin" "web" {
  count                         = var.enable_front_door ? 1 : 0
  name                          = "web"
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.web[0].id
  host_name                     = azurerm_container_app.web.ingress[0].fqdn

  # Container Apps picks the app by Host header, so it must be the app's own
  # name rather than the Front Door host name the browser used.
  origin_host_header             = azurerm_container_app.web.ingress[0].fqdn
  certificate_name_check_enabled = true

  http_port  = 80
  https_port = 443
  priority   = 1
  weight     = 1000
}

# Two routes. Front Door uses the most specific pattern that matches, so /api/*
# requests never reach the caching route below.

# API calls are never cached: responses are per user, and a cached one could be
# served to somebody else. No `cache` block means caching is off.
resource "azurerm_cdn_frontdoor_route" "api" {
  count                         = var.enable_front_door ? 1 : 0
  name                          = "api"
  cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.main[0].id
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.web[0].id
  cdn_frontdoor_origin_ids      = [azurerm_cdn_frontdoor_origin.web[0].id]
  patterns_to_match             = ["/api/*"]
  supported_protocols           = ["Http", "Https"]
  https_redirect_enabled        = true
  forwarding_protocol           = "HttpsOnly"
  link_to_default_domain        = true
}

# Everything else is the Angular app. Front Door keeps a copy for as long as
# nginx's Cache-Control header allows: a year for the hashed bundles, and never
# for index.html, so a deploy shows up on the next page load.
resource "azurerm_cdn_frontdoor_route" "site" {
  count                         = var.enable_front_door ? 1 : 0
  name                          = "site"
  cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.main[0].id
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.web[0].id
  cdn_frontdoor_origin_ids      = [azurerm_cdn_frontdoor_origin.web[0].id]
  patterns_to_match             = ["/*"]
  supported_protocols           = ["Http", "Https"]
  https_redirect_enabled        = true
  forwarding_protocol           = "HttpsOnly"
  link_to_default_domain        = true

  cache {
    query_string_caching_behavior = "UseQueryString"
  }
}

# ---------------------------------------------------------------------------
# The firewall (WAF) policy
# ---------------------------------------------------------------------------
# On the Standard tier we write our own rules; Microsoft's managed attack rule
# sets are Premium only. Counts are per client IP address, and approximate:
# Front Door counts on each of its servers, so with low limits a few extra
# requests can get through.

resource "azurerm_cdn_frontdoor_firewall_policy" "main" {
  count               = var.enable_front_door ? 1 : 0
  name                = "${local.compact_prefix}waf"
  resource_group_name = azurerm_resource_group.app.name
  sku_name            = azurerm_cdn_frontdoor_profile.main[0].sku_name
  mode                = "Prevention"

  # Every rule here is a rate limit, so a blocked request is answered with
  # 429 Too Many Requests.
  custom_block_response_status_code = 429

  # Sign-in, sign-up and password reset: the targets of password guessing and
  # mass sign-ups. The API keeps its own exact limits (10 sign-ins a minute,
  # 5 sign-ups an hour); this stops a flood before it reaches the container.
  custom_rule {
    name                           = "AuthRateLimit"
    type                           = "RateLimitRule"
    priority                       = 1
    rate_limit_duration_in_minutes = 1
    rate_limit_threshold           = 30
    action                         = "Block"

    match_condition {
      match_variable = "RequestUri"
      operator       = "Contains"
      # Decoded and lower-cased before comparing. The API matches routes
      # case-insensitively and after decoding, so /api/AUTH/login and
      # /api/%61uth/login would otherwise reach it without being counted.
      transforms   = ["UrlDecode", "Lowercase"]
      match_values = ["/api/auth/"]
    }
  }

  # All requests. A page load is roughly 15 requests, so this allows about 60
  # page loads in five minutes from one address.
  custom_rule {
    name                           = "SiteRateLimit"
    type                           = "RateLimitRule"
    priority                       = 2
    rate_limit_duration_in_minutes = 5
    rate_limit_threshold           = 1000
    action                         = "Block"

    match_condition {
      match_variable = "RequestUri"
      operator       = "Contains"
      match_values   = ["/"]
    }
  }

  tags = var.tags
}

# Applies the policy to the endpoint.
resource "azurerm_cdn_frontdoor_security_policy" "main" {
  count                    = var.enable_front_door ? 1 : 0
  name                     = "waf"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main[0].id

  security_policies {
    firewall {
      cdn_frontdoor_firewall_policy_id = azurerm_cdn_frontdoor_firewall_policy.main[0].id

      association {
        patterns_to_match = ["/*"]

        domain {
          cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_endpoint.main[0].id
        }
      }
    }
  }
}

# The IP ranges Front Door connects to origins from, as Azure currently
# publishes them under the AzureFrontDoor.Backend service tag. Container Apps
# IP rules take address ranges, not tag names, so the list is read here at
# every plan and each apply picks up Microsoft's changes. New ranges are
# published at least a week before Front Door uses them, so applying at least
# weekly keeps it current. A stale list shows up as some visitors getting
# "RBAC: access denied" from the web app; `terraform apply` fixes it.
data "azurerm_network_service_tags" "front_door" {
  count    = var.enable_front_door ? 1 : 0
  location = azurerm_resource_group.app.location
  service  = "AzureFrontDoor.Backend"
}
