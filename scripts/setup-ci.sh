#!/usr/bin/env bash
# One-time wiring after `terraform apply`: push the infra outputs into GitHub Actions repo
# variables so the Deploy workflow can assume the role and target the right cluster/ECR.
# Requires: gh authed to github.com, run from anywhere in the repo, TF already applied.
set -euo pipefail

REPO="isaacjensen/trm-eth-explorer"
TF_DIR="$(cd "$(dirname "$0")/../deploy/terraform" && pwd)"

get() { terraform -chdir="$TF_DIR" output -raw "$1"; }

gh variable set AWS_REGION       --repo "$REPO" --body "$(get region)"
gh variable set ECR_REPOSITORY   --repo "$REPO" --body "$(get ecr_repository_url)"
gh variable set EKS_CLUSTER_NAME --repo "$REPO" --body "$(get cluster_name)"
gh variable set CI_ROLE_ARN      --repo "$REPO" --body "$(get ci_deploy_role_arn)"
gh variable set APP_SECRET_ID    --repo "$REPO" --body "$(get app_secret_name)"

echo "Repo variables set."
echo
echo "Still to do in GitHub (Settings > Environments), one-time:"
echo "  - Create environment 'staging'    (no protection)"
echo "  - Create environment 'production' (add yourself as a Required reviewer = the prod gate)"
