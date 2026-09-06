# =============================================================================
# GitHub Actions -> AWS via OIDC federation (NO static AWS keys in CI).
#
# GitHub issues each workflow run a short-lived OIDC token describing WHO is running
# (which repo, which branch). AWS trusts that token issuer and lets the run assume a
# role IF the token's claims match our conditions. Nothing long-lived is ever stored
# in GitHub. This file is the security boundary of the whole pipeline; it is written
# to be least-privilege and reviewed by hand.
# =============================================================================

# (1) Register GitHub's OIDC identity provider in this account.
# The thumbprint is computed from GitHub's live certificate rather than hardcoded.
data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  # The audience the workflow requests (aws-actions/configure-aws-credentials default).
  client_id_list = ["sts.amazonaws.com"]

  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

# -----------------------------------------------------------------------------
# (2) TRUST POLICY — WHO may assume the role.
# Federated to the GitHub OIDC provider, then narrowed by two conditions:
#   - aud == sts.amazonaws.com          (the audience we configure in the workflow)
#   - sub == repo:<owner/repo>:ref:<ref>  EXACT match — this repo, this branch only.
#
# The `sub` condition is the line that matters most. A wildcard here (e.g.
# "repo:isaacjensen/*" or ":ref:*") would let OTHER repositories or branches assume
# this role — a real privilege-escalation hole. We pin owner/repo AND the ref so only
# main-branch runs of THIS repo can deploy. Pull-request runs (different sub) cannot.
# -----------------------------------------------------------------------------
data "aws_iam_policy_document" "ci_trust" {
  statement {
    sid     = "GithubOidcAssume"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:ref:${var.github_deploy_ref}"]
    }
  }
}

resource "aws_iam_role" "ci_deploy" {
  name               = "${var.cluster_name}-ci-deploy"
  description        = "Assumed by GitHub Actions (main branch) to build/push images and deploy."
  assume_role_policy = data.aws_iam_policy_document.ci_trust.json
}

# -----------------------------------------------------------------------------
# (3) PERMISSIONS POLICY — WHAT the role may do (least privilege).
#   - ecr:GetAuthorizationToken must be "*" (the API grants an account-scoped token;
#     it does not accept a resource ARN). It only yields a login token, not access.
#   - All push/pull actions are scoped to THIS repo's ARN only.
#   - eks:DescribeCluster on THIS cluster only, needed for `aws eks update-kubeconfig`.
# In-cluster deploy rights (kubectl/helm) come from the EKS access entry in eks.tf
# (namespace-scoped edit), NOT from IAM. There is deliberately no ec2:*, iam:*, or
# eks:Create* here — CI can deploy the app but cannot touch the platform.
# -----------------------------------------------------------------------------
data "aws_iam_policy_document" "ci_permissions" {
  statement {
    sid       = "EcrAuthToken"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "EcrPushPullThisRepo"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
    ]
    resources = [aws_ecr_repository.app.arn]
  }

  statement {
    sid       = "EksDescribeThisCluster"
    effect    = "Allow"
    actions   = ["eks:DescribeCluster"]
    resources = [module.eks.cluster_arn]
  }
}

resource "aws_iam_role_policy" "ci_permissions" {
  name   = "${var.cluster_name}-ci-deploy"
  role   = aws_iam_role.ci_deploy.id
  policy = data.aws_iam_policy_document.ci_permissions.json
}
