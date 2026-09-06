output "region" {
  description = "AWS region the infra lives in."
  value       = var.region
}

output "cluster_name" {
  description = "EKS cluster name (for `aws eks update-kubeconfig`)."
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS API server endpoint."
  value       = module.eks.cluster_endpoint
}

output "ecr_repository_url" {
  description = "ECR repo URL to tag/push images to."
  value       = aws_ecr_repository.app.repository_url
}

output "ci_deploy_role_arn" {
  description = "IAM role ARN for GitHub Actions to assume via OIDC (set as a CI secret/var)."
  value       = aws_iam_role.ci_deploy.arn
}

output "configure_kubeconfig_command" {
  description = "Run this to point kubectl/helm at the cluster."
  value       = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.cluster_name}"
}

output "app_secret_name" {
  description = "Secrets Manager secret holding the app's runtime secrets (set APP_SECRET_ID to this)."
  value       = aws_secretsmanager_secret.app.name
}

output "set_secret_values_command" {
  description = "Run once after apply to populate the secret values (they are not managed by Terraform)."
  value       = "aws secretsmanager put-secret-value --secret-id ${aws_secretsmanager_secret.app.name} --secret-string '{\"INFURA_API_KEY\":\"<key>\",\"AUTH_JWT_SECRET\":\"<secret>\"}'"
}
