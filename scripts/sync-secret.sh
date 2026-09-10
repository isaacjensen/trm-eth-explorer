#!/usr/bin/env bash
#
# Create (or update) the app's Kubernetes Secret in a namespace, reading the values from
# AWS Secrets Manager (the source of truth). Run by CI at deploy time: the CI role can
# read this one secret and edit the target namespace. The Helm chart references the
# Secret by name (existingSecret), and the values are never printed to logs.
#
set -euo pipefail

# Which namespace to create the Secret in.
namespace="$1"
if [ -z "$namespace" ]; then
  echo "usage: sync-secret.sh <namespace>" >&2
  exit 1
fi

# Which Secrets Manager secret to read (e.g. trm-eth-explorer/app).
if [ -z "${APP_SECRET_ID:-}" ]; then
  echo "APP_SECRET_ID must be set" >&2
  exit 1
fi

# Fetch the secret (a JSON blob), then pull out each value.
secret_json="$(aws secretsmanager get-secret-value --secret-id "$APP_SECRET_ID" --query SecretString --output text)"
infura_api_key="$(echo "$secret_json" | jq -r '.INFURA_API_KEY')"
auth_jwt_secret="$(echo "$secret_json" | jq -r '.AUTH_JWT_SECRET')"

# Create-or-update: render the Secret to YAML and pipe to `apply`, so it works whether
# the Secret already exists or not.
kubectl create secret generic trm-eth-explorer-secrets \
  --namespace "$namespace" \
  --from-literal=INFURA_API_KEY="$infura_api_key" \
  --from-literal=AUTH_JWT_SECRET="$auth_jwt_secret" \
  --dry-run=client -o yaml | kubectl apply -f -
