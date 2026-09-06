# Two-AZ VPC. Workloads run in the private subnets (no public IPs) and reach the
# internet (Infura, ECR) outbound through a NAT gateway. Public subnets host only the
# load balancer(s).

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs      = slice(data.aws_availability_zones.available.names, 0, 2)
  vpc_cidr = "10.0.0.0/16"
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.13"

  name = "${var.cluster_name}-vpc"
  cidr = local.vpc_cidr
  azs  = local.azs

  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
  # Single NAT gateway to save cost on a throwaway env (~$32/mo vs one-per-AZ).
  # Tradeoff: a single AZ failure could sever egress; one NAT per AZ is the HA upgrade.
  single_nat_gateway = true

  enable_dns_hostnames = true
  enable_dns_support   = true

  # Subnet tags let the AWS Load Balancer / in-tree controller discover where to place
  # public vs internal load balancers.
  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }
}
