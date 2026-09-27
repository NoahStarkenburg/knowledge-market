# Inputs to this configuration. Values live in prod.tfvars, not here, so the same
# code could deploy another environment with a different .tfvars file.

variable "location" {
  description = "Azure region for everything except the global Front Door profile."
  type        = string
  default     = "centralus"
}

variable "prefix" {
  description = "Prefix for resource names, e.g. knowledgemarket-api."
  type        = string
  default     = "knowledgemarket"

  validation {
    # Many Azure names allow only lowercase letters, digits and hyphens. Catching
    # a bad prefix here gives a clear message at plan time, instead of an Azure
    # API error halfway through an apply.
    condition     = can(regex("^[a-z][a-z0-9-]{2,20}$", var.prefix))
    error_message = "prefix must be 3-21 characters: lowercase letters, digits and hyphens, starting with a letter."
  }
}

variable "tags" {
  description = "Tags applied to every resource, so cost and ownership can be filtered in the portal."
  type        = map(string)
  default = {
    project    = "knowledgemarket"
    managed_by = "terraform"
  }
}

variable "admin_email" {
  description = "Sign-in email of the admin account the API creates on its first start. Its password is generated into Key Vault."
  type        = string

  # No default, and not in any committed file: set it as TF_VAR_admin_email, the
  # same way ARM_SUBSCRIPTION_ID is kept out of the repository.

  # Caught here, at plan time. An empty value would otherwise reach the API,
  # which refuses to start in Production without one.
  validation {
    condition     = can(regex("^[^@ ]+@[^@ ]+[.][^@ ]+$", var.admin_email))
    error_message = "admin_email must be an email address. Set it with $env:TF_VAR_admin_email = \"you@example.com\"."
  }
}

variable "api_min_replicas" {
  description = "API replicas kept running with no traffic. 1 means no cold start on the first request; 0 costs nothing while idle."
  type        = number
  default     = 1

  validation {
    condition     = contains([0, 1], var.api_min_replicas)
    error_message = "api_min_replicas must be 0 or 1. The API allows one replica at most while it migrates the database at startup."
  }
}

variable "enable_redis" {
  description = "Create Azure Managed Redis for the API's cache. When false the API runs with no cache and every read goes to SQL."
  type        = bool
  default     = true
}

variable "sql_private_endpoint" {
  description = "Reach Azure SQL through a private endpoint inside the virtual network (about $7 a month). When false, SQL keeps a public endpoint open to Azure services only, still with Entra ID sign-in only."
  type        = bool
  default     = true
}

variable "enable_front_door" {
  description = "Put Azure Front Door (edge caching, firewall rate limits) in front of the site, and accept web traffic only through it. About $35 a month; when false the web app is public on its own address."
  type        = bool
  default     = true
}

variable "load_test_allowed_ips" {
  description = "Addresses, in CIDR form such as 203.0.113.7/32, that Front Door's rate limits let through, for a load test run from a known machine. Leave empty. Pass it on the command line for the length of a test only, and never commit an address."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for c in var.load_test_allowed_ips : can(cidrhost(c, 0))])
    error_message = "Each entry must be an address in CIDR form, such as 203.0.113.7/32."
  }
}

variable "stripe_enabled" {
  description = "Turn on Stripe checkout. The secret key and webhook signing secret must already be in Key Vault as stripe-secret-key and stripe-webhook-secret. Their values never pass through Terraform."
  type        = bool
  default     = false
}

variable "stripe_publishable_key" {
  description = "Stripe publishable key (pk_test_... or pk_live_...). Public by design: it is also compiled into the front end."
  type        = string
  default     = ""

  validation {
    condition     = !var.stripe_enabled || can(regex("^pk_(test|live)_", var.stripe_publishable_key))
    error_message = "stripe_publishable_key must be set (pk_test_... or pk_live_...) when stripe_enabled is true."
  }
}

variable "stripe_subscription_price_id" {
  description = "Stripe price ID (price_...) of the monthly subscription. Leave empty to offer one-time purchases only."
  type        = string
  default     = ""
}
