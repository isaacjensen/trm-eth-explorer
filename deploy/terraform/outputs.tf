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
