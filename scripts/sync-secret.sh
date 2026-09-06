#!/usr/bin/env bash
# Materialize the k8s Secret for a namespace from Secrets Manager (the source of truth).
# Run by CI at deploy time; the CI role has secretsmanager:GetSecretValue on this one
# secret and edit rights in the target namespace. The chart references this Secret by name.
set -euo pipefail

NS="${1:?usage: sync-secret.sh <namespace>}"
: "${APP_SECRET_ID:?APP_SECRET_ID must be set}"

SECRET_JSON="$(aws secretsmanager get-secret-value --secret-id "$APP_SECRET_ID" --query SecretString --output text)"
INFURA_API_KEY="$(jq -r .INFURA_API_KEY <<<"$SECRET_JSON")"
AUTH_JWT_SECRET="$(jq -r .AUTH_JWT_SECRET <<<"$SECRET_JSON")"

# create-or-update without echoing values into logs.
kubectl create secret generic trm-eth-explorer-secrets \
  --namespace "$NS" \
  --from-literal=INFURA_API_KEY="$INFURA_API_KEY" \
  --from-literal=AUTH_JWT_SECRET="$AUTH_JWT_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -
