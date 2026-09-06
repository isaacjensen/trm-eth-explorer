variable "region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-west-2"
}

variable "cluster_name" {
  description = "Name shared by the EKS cluster, ECR repo, and derived resources."
  type        = string
  default     = "trm-eth-explorer"
}

variable "kubernetes_version" {
  description = "EKS control-plane Kubernetes version."
  type        = string
  default     = "1.31"
}

variable "node_instance_type" {
  description = "EC2 instance type for the managed node group."
  type        = string
  default     = "t3.medium"
}

variable "app_namespaces" {
  description = "Kubernetes namespaces the CI deploy role may deploy into."
  type        = list(string)
  default     = ["staging", "prod"]
}

# --- GitHub OIDC federation (consumed by the CI deploy role trust policy) -----
variable "github_repo" {
  description = "owner/repo permitted to assume the CI deploy role via OIDC."
  type        = string
  default     = "isaacjensen/trm-eth-explorer"
}

variable "github_deploy_ref" {
  description = "Git ref permitted to assume the CI deploy role (branch that deploys)."
  type        = string
  default     = "refs/heads/main"
}
