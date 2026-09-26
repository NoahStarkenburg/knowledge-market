# Non-secret production settings. Terraform loads any *.auto.tfvars file in this
# folder automatically, so every plan and apply gets them without anything being
# typed in. Secrets never go here: they live in Key Vault.
#
# When QA and staging exist, this becomes prod.tfvars, passed explicitly with
# -var-file, next to qa.tfvars and staging.tfvars.

stripe_enabled = true

# Public by design: Stripe publishable keys identify the account and are also
# compiled into the front end, where anyone can read them.
stripe_publishable_key = "pk_test_51T5BfrJ3UJdYmXSLi32geMFyJBezmUNb3qyqYdmvVFFU0GXUouiGG7T6Z0dNjVuec9PBam8YvMjKE3anLBncpVni006JAsHRsX"
