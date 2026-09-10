#!/usr/bin/env bash
#
# Post-deploy smoke test for a namespace (staging or prod).
# Proves the deployment works end to end: mint a token, make a real authenticated
# balance call, and confirm a balance comes back. `helm --wait --atomic` already
# gated on the pods being healthy; this adds the real-call check on top.
#
set -euo pipefail

# Which namespace to test.
namespace="$1"
if [ -z "$namespace" ]; then
  echo "usage: smoke-test.sh <namespace>" >&2
  exit 1
fi

address="0xc94770007dda54cF92009BFF0dE90c06F603a09f" # the prompt address (holds 0 ETH)
url="http://localhost:18080"                          # local end of the port-forward below

# Mint a token. mint-token.js reads the signing secret from Secrets Manager.
token="$(node scripts/mint-token.js)"
if [ -z "$token" ]; then
  echo "failed to mint a token" >&2
  exit 1
fi

# Open a port-forward to the in-cluster Service (avoids waiting on the NLB to provision).
# It runs in the background; the trap stops it whenever this script exits.
kubectl port-forward -n "$namespace" svc/trm-eth-explorer 18080:80 >/dev/null 2>&1 &
port_forward_pid=$!
trap "kill $port_forward_pid 2>/dev/null || true" EXIT

# Wait for the port-forward to be ready via a health check (retries; no auth needed).
curl --silent --fail --retry 20 --retry-connrefused --retry-delay 1 "$url/healthz" >/dev/null

# The real test: an authenticated balance call. --fail makes curl exit non-zero on any non-2xx.
response="$(curl --silent --fail --header "Authorization: Bearer $token" "$url/address/balance/$address")"

# Confirm the response actually contains a balance.
echo "$response" | jq -e 'has("balance")' >/dev/null
echo "smoke OK ($namespace): authenticated balance call returned 200 -> $response"
