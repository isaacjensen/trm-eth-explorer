terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    # Used once, to compute the GitHub OIDC provider thumbprint (see iam-oidc.tf).
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Local state: only this laptop provisions, into a throwaway account, and CI never
  # runs Terraform — so a shared/locked backend buys nothing here. In a team (or if CI
  # provisioned infra) this would be an S3 backend with native locking.
}

provider "aws" {
  region = var.region

  # Tag everything so the throwaway resources are easy to find and clean up.
  default_tags {
    tags = {
      Project   = "trm-eth-explorer"
      ManagedBy = "terraform"
    }
  }
}
