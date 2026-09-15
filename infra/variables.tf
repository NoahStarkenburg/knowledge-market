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
