# Application secrets (INFURA_API_KEY, AUTH_JWT_SECRET) live in Secrets Manager as the
# source of truth. Terraform creates the secret CONTAINER only — the actual values are
# set out-of-band so plaintext never enters Terraform state or code:
#
#   aws secretsmanager put-secret-value --secret-id trm-eth-explorer/app \
#     --secret-string '{"INFURA_API_KEY":"...","AUTH_JWT_SECRET":"..."}'
#
# At deploy time CI reads this (GetSecretValue) and materializes a Kubernetes Secret,
# which EKS then encrypts at rest with KMS. The mint-token dev script reads it locally
# to sign demo tokens. Production would add External Secrets Operator for continuous
# sync + rotation instead of a pull-at-deploy step.

resource "aws_secretsmanager_secret" "app" {
  name        = "${var.cluster_name}/app"
  description = "Runtime secrets for trm-eth-explorer (INFURA_API_KEY, AUTH_JWT_SECRET)."

  # Throwaway env: delete immediately on destroy rather than holding the name for the
  # default 30-day recovery window (which would block recreating with the same name).
  recovery_window_in_days = 0
}
