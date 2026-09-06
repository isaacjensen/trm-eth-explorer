#!/usr/bin/env bash
# Post-deploy smoke test. `helm --wait --atomic` is the primary gate (pods must pass
# readiness or the release auto-rolls-back); this adds an in-cluster hit of /healthz via
# the Service, which avoids waiting for the external NLB to provision.
set -euo pipefail

NS="${1:?usage: smoke-test.sh <namespace>}"
URL="http://trm-eth-explorer.${NS}.svc.cluster.local/healthz"

kubectl run "smoke-$RANDOM" \
  --namespace "$NS" \
  --rm -i --restart=Never \
  --image=curlimages/curl:latest \
  --command -- curl -sf --max-time 10 "$URL"
