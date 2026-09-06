#!/usr/bin/env bash
# Post-deploy smoke test. `helm --wait --atomic` is the primary gate (pods must pass
# readiness or the release auto-rolls-back). This adds a real, END-TO-END check: mint a
# valid token, then make an authenticated Balance API call and assert HTTP 200 with a
# balance. A green run means: app up + auth working + Infura reachable + a real balance
# returned. We reach the Service via `kubectl port-forward` to avoid waiting on the NLB.
#
# Note: this couples deploy success to Infura being reachable — deliberate here (we want
# real-call confidence); a mature setup might use a synthetic check to avoid gating on
# upstream health.
set -euo pipefail

NS="${1:?usage: smoke-test.sh <namespace>}"
: "${APP_SECRET_ID:?APP_SECRET_ID must be set (mint-token reads the signing secret from it)}"

SVC="trm-eth-explorer"
LOCAL_PORT=18080
ADDR="${SMOKE_ADDRESS:-0xc94770007dda54cF92009BFF0dE90c06F603a09f}" # prompt address (holds 0 ETH)

# 1) Mint a valid token (mint-token.js pulls AUTH_JWT_SECRET from Secrets Manager).
TOKEN="$(node scripts/mint-token.js)"

# 2) Port-forward the in-cluster Service to the runner.
kubectl port-forward -n "$NS" "svc/${SVC}" "${LOCAL_PORT}:80" >/dev/null 2>&1 &
PF_PID=$!
trap 'kill "$PF_PID" 2>/dev/null || true' EXIT

# 3) Wait for the forward to be ready (health first — no auth needed).
for _ in $(seq 1 20); do
  curl -sf -o /dev/null "http://localhost:${LOCAL_PORT}/healthz" && break
  sleep 1
done

# 4) Real authenticated Balance API call — curl -sf fails the script on any non-2xx.
RESP="$(curl -sf -H "Authorization: Bearer ${TOKEN}" \
  "http://localhost:${LOCAL_PORT}/address/balance/${ADDR}")"
echo "balance response: ${RESP}"

# 5) Assert the body actually carries a balance.
echo "${RESP}" | jq -e 'has("balance")' >/dev/null
echo "smoke OK (${NS}): authenticated balance call returned 200 with a balance"
