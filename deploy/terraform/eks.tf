# EKS cluster + a small managed node group in the private subnets. The control plane is
# AWS-managed (we don't run masters). Access is governed by EKS access entries (the
# modern replacement for the aws-auth ConfigMap).

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.24"

  cluster_name    = var.cluster_name
  cluster_version = var.kubernetes_version

  # Public API endpoint so kubectl/helm can reach the cluster from this laptop and from
  # GitHub-hosted CI runners. (Private-only + a bastion/VPN is the hardening upgrade.)
  cluster_endpoint_public_access = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # Core cluster addons, versions chosen by the module for the k8s version.
  cluster_addons = {
    coredns    = {}
    kube-proxy = {}
    vpc-cni    = {}
  }

  eks_managed_node_groups = {
    default = {
      instance_types = [var.node_instance_type]
      min_size       = 2
      max_size       = 4
      desired_size   = 2
    }
  }

  # The identity that runs `terraform apply` (the bootstrap admin) gets cluster-admin,
  # so you can kubectl/helm locally right after apply.
  enable_cluster_creator_admin_permissions = true

  # Map the CI deploy IAM role into the cluster with LEAST-PRIVILEGE Kubernetes rights:
  # edit only within the app namespaces, nothing cluster-wide. This is the in-cluster
  # half of CI's access; the IAM half (see iam-oidc.tf) only allows DescribeCluster.
  access_entries = {
    ci_deploy = {
      principal_arn = aws_iam_role.ci_deploy.arn
      type          = "STANDARD"

      policy_associations = {
        edit = {
          policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSEditPolicy"
          access_scope = {
            type       = "namespace"
            namespaces = var.app_namespaces
          }
        }
      }
    }
  }
}
