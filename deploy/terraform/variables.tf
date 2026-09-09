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
  description = "EKS control-plane Kubernetes version. Keep on a STANDARD_SUPPORT version — extended support ~6x's the control-plane cost. Check: aws eks describe-cluster-versions."
  type        = string
  default     = "1.34"
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
# GitHub's default OIDC subject now embeds the IMMUTABLE owner-ID and repo-ID
# (repo:<owner>@<owner_id>/<repo>@<repo_id>), not the plain repo:<owner>/<repo>. The trust
# policy must match this exact prefix or AssumeRoleWithWebIdentity fails "Not authorized".
# Bonus: pinning the numeric IDs means a repo/owner rename can't hijack the trust.
# Verify with: gh api repos/<owner>/<repo>/actions/oidc/customization/sub
variable "github_sub_prefix" {
  description = "OIDC subject prefix GitHub issues for this repo (immutable-ID form)."
  type        = string
  default     = "repo:isaacjensen@11186577/trm-eth-explorer@1358620534"
}

variable "github_deploy_ref" {
  description = "Git ref permitted to assume the CI deploy role (branch that deploys)."
  type        = string
  default     = "refs/heads/main"
}

variable "github_environments" {
  description = "GitHub Actions environments permitted to assume the CI deploy role. Jobs that use `environment:` get a sub of ...:environment:<name> instead of ...:ref:<ref>."
  type        = list(string)
  default     = ["staging", "production"]
}
