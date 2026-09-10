# trm-eth-explorer — project context

HTTP service that returns the current ETH balance of an Ethereum address, read from
Ethereum mainnet via Infura's JSON-RPC API. A TRM Labs take-home: the app is an MVP; the
real work is the operational surface — containerization, EKS deploy via Terraform, GitHub
Actions CI/CD, security. Private repo: `github.com/isaacjensen/trm-eth-explorer`.

See also: `CONTEXT.md` (gitignored — private handoff, live resource IDs, interview
strategy, go-live checklist) and `NOTES.md` (AI-usage log + productionization roadmap).

## Contract
- `GET /address/balance/:address` → `{ "balance": <number> }` (ETH). Requires a bearer JWT
  (see Auth) when configured.
- `GET /healthz` (liveness), `GET /readyz` (readiness — does NOT call upstream by design),
  `GET /metrics` (Prometheus). These three are unauthenticated (probes/scrapers).

## Stack & conventions
- Node 22 LTS (app runs ≥18; container + CI on 22). **CommonJS**, Express.
- `ethers` used ONLY for BigInt-safe wei→ETH (`formatEther`), not the network call.
- `jsonwebtoken` for auth; `pino`/`pino-http` logs; `prom-client` metrics; `helmet`.
- Jest + supertest. `npm test`, `npm run lint` (ESLint flat config). npm scripts = task runner.

## App architecture (layered, models iam-service-lambda; PascalCase controllers/services)
```
src/
  app.js            express app factory (no listen; testable)
  server.js         entry: listen + graceful SIGTERM shutdown
  config.js         env config, fail-fast; auth fails CLOSED in production
  metrics.js        prom-client registry (route-pattern labels; auth_attempts_total,
                    balance_cache_lookups_total)
  routes/           balance.js, health.js  — thin: path -> controller (+ requireAuth)
  controllers/      Balance.js, Health.js  — HTTP layer (validate, shape, map errors)
  services/         BalanceService.js       — domain: getBalanceEth (eth_getBalance + formatEther)
  utils/              ethRpc.js (JSON-RPC transport: 3s timeout, 1 bounded retry, UpstreamError)
                    cache.js (bounded short-TTL in-process cache), validate.js
                    (format-only 0x+40hex), logger.js (redacts secrets)
  middleware/       auth.js  — bearer-JWT verify + scope authz
scripts/            mint-token.js (demo token, from SM or env), sync-secret.sh,
                    smoke-test.sh, setup-ci.sh
test/               validate, BalanceService (+ caching), balance (route), auth, config,
                    ethRpc, cache  (51 tests)
```
Flow: client → NLB → routes → requireAuth → controller → service → cache → ethRpc → Infura.
Adding a chain stat = one file per layer, reusing ethRpc.

## Auth (bearer JWT)
- `requireAuth` (middleware/auth.js) on the balance route only. `jwt.verify` decodes+verifies
  HS256 (signature, exp, optional aud/iss) → 401 on fail; then requires `balance:read` scope
  → 403 `insufficient_scope`.
- Config-driven: enforced when `AUTH_JWT_SECRET` set. **Fails closed in production** (config
  throws if NODE_ENV=production and no secret) so the deployed service can never run open.
  Dev/test open when unset (jest = NODE_ENV=test).
- MVP = HS256 shared secret; prod path = RS256 against IdP JWKS (same middleware).
- Rationale: protect the Infura quota/cost + per-client fairness, NOT the (public) data.

## Caching (in-process, short-TTL — utils/cache.js)
- Strategy: a per-pod TTL cache backed by a plain `Map` of `key -> {value, expiresAt}`, keyed by
  `lowercased-address:latest`. No hash function of our own (the `Map` does key lookup); no
  consistent hashing (that's a distributed-cache concern — see below). `BalanceService` checks
  it before calling upstream and populates on success ONLY (errors are never cached).
- Eviction: (1) TTL expiry, checked lazily on read; (2) bounded `maxEntries` with oldest-inserted
  (FIFO) eviction when full — deliberately not LRU (no per-read recency bookkeeping for an MVP).
- Config: `CACHE_TTL_MS` (default 0 = OFF, so dev/test are deterministic) + `CACHE_MAX_ENTRIES`
  (default 10000). Helm sets `CACHE_TTL_MS=5000` in base values → staging + prod run a 5s cache.
  Metric: `balance_cache_lookups_total{result=hit|miss}`.
- Purpose: collapse repeat lookups of a hot address into one Infura call — the concrete
  mitigation for the "every request fans out to Infura" bottleneck.
- Deliberate limits (defend these): per-pod, not shared, so hit rate drops as replicas scale
  (prod = shared Redis/ElastiCache, where consistent hashing / Redis hash slots pick the shard);
  staleness is bounded by the TTL (a balance can change every block, so TTL is the accuracy-vs-
  load knob — matters for a forensics product); no stampede protection yet (single-flight next).

## Container (deploy/Dockerfile)
- Multi-stage: `node:22-bookworm-slim` builder (`npm ci --omit=dev`) → runtime
  `gcr.io/distroless/nodejs22-debian12:nonroot` (no shell/pkg-mgr, uid 65532, ~181MB).
- Node 22 base (18 was EOL → stale openssl failed scans). `.trivyignore` tracks residual
  base-image openssl CVEs (fix not yet in distroless; no apt to patch ourselves; our
  code/deps still hard-fail the scan).
- Local builds behind corp TLS proxy inject the corp CA via an optional BuildKit
  `--secret id=corp_ca` (build-time only, never in a layer, TLS stays ON).

## Infrastructure (deploy/terraform/ — single root module, LOCAL state, us-west-2)
- Applied by hand from `.aws-local` admin (`ijensen`) with a hand-reviewed plan (the no-AI
  gate). **CI never runs Terraform** — infra is separate from the app-deploy pipeline
  (least privilege / blast radius). Prod path = S3 remote state + gated infra pipeline
  (Atlantis/TF Cloud), articulated not built.
- Creates: VPC (2 AZ, public+private, single NAT), EKS (**1.34**, 2× t3.medium managed
  nodes, KMS secret encryption on by default), ECR (scan-on-push, immutable tags, lifecycle),
  GitHub OIDC provider + scoped CI role, Secrets Manager secret container, EKS access entries.
- Live IDs (account 687734796179): cluster `trm-eth-explorer`; ECR
  `687734796179.dkr.ecr.us-west-2.amazonaws.com/trm-eth-explorer`; CI role
  `arn:aws:iam::687734796179:role/trm-eth-explorer-ci-deploy`; SM secret `trm-eth-explorer/app`.
- EKS access: `ijensen` = cluster-admin (creator); CI role = edit on `staging`/`prod` namespaces.

## CI/CD (.github/workflows/)
- `ci.yml` (on PR): lint + test + docker build + Trivy scan. App-only, no AWS.
- `deploy.yml` (push to main): OIDC assume CI role → build → **git-SHA tag** push to ECR
  (immutable, no `latest`) → deploy `staging` (helm --wait --atomic) → **authenticated
  balance smoke test** (mints token from SM, asserts 200). Auto on merge.
- `deploy-prod.yml` (manual `workflow_dispatch`, input `image_tag`): promotes the staged SHA
  to `prod` (no rebuild) → smoke. **Manual = the gate** (required-reviewer env protection
  needs a paid plan on private repos → HTTP 422; manual dispatch is free + a strong
  deliberate-promotion story).
- **OIDC gotcha (fixed):** GitHub issues immutable-ID subjects —
  `repo:isaacjensen@11186577/trm-eth-explorer@1358620534:...`, not `repo:owner/repo:...`.
  Trust policy pins that prefix (`github_sub_prefix` var); 3-value allowlist (ref:main +
  environment:staging/production), no wildcards. Verify: `gh api repos/OWNER/REPO/actions/oidc/customization/sub`.
- Secrets flow: SM (source of truth) → CI `get-secret-value` (`sync-secret.sh`) → k8s Secret
  → pod env, KMS-encrypted at rest. `mint-token.js` reads SM locally to sign demo tokens.
- GitHub repo variables (set by `setup-ci.sh`): AWS_REGION, ECR_REPOSITORY, EKS_CLUSTER_NAME,
  CI_ROLE_ARN, APP_SECRET_ID. Environments `staging` + `production` exist (no reviewer — free plan).

## Helm (deploy/helm/trm-eth-explorer/)
- Lean chart: Deployment, Service (NLB, internet-facing), HPA (CPU), PDB (minAvailable 1),
  IRSA-ready ServiceAccount; base values + values-staging/prod overlays.
- Hardened: pod `runAsNonRoot`/uid 65532/`seccompProfile: RuntimeDefault`; container
  `readOnlyRootFilesystem` (+ /tmp emptyDir), `allowPrivilegeEscalation:false`, drop ALL caps.
- `NODE_ENV=production` (fail-closed auth on); `CACHE_TTL_MS=5000` (balance cache on); secrets
  via `secretKeyRef` to `existingSecret`.
- metrics-server required for CPU HPA (EKS doesn't ship it) — installed once via helm.

## Key design decisions & tradeoffs (defend these)
- **Precision:** conversion exact end-to-end (BigInt→formatEther string); the ONE lossy step
  is `Number()` at balance.js (spec's JSON-number contract). Fix = add a `wei` string field.
  Big balances (e.g. Beacon deposit contract ~9e7 ETH) visibly lose the low digits.
- **Block tag `latest`** (can reorg) vs safe/finalized — fine for an explorer; TRM = forensics
  so know the distinction.
- **Format-only validation** (not EIP-55) so the prompt's address casing isn't rejected.
- **Readiness doesn't call upstream** (avoid Infura quota burn + flapping); smoke test + error-
  rate metrics cover upstream health instead.
- **EKS over Fargate/App Runner:** deliberate, to show operability surface (HPA/PDB/rolling/IRSA).
- **Autoscaling:** CPU HPA for MVP; service is I/O-bound so request-rate/KEDA is the real signal.
- **NLB (L4) for MVP:** works; L7 (ALB Ingress + ACM TLS + WAF rate-limiting) is the prod add.
- **HTTP, no TLS** for the demo (deliberate scope cut); prod terminates TLS at ALB, HTTP to pods
  in the private VPC (bearer token over HTTP would be cleartext — TLS non-negotiable in prod).
- **Deploy model:** staging auto (pre-prod verification), prod manual promotion of same SHA,
  rollback via `helm rollback`; ephemeral per-PR envs = documented next step.
- **IRSA** is the "many APIs hitting many AWS services" answer (per-workload IAM on the SA).

## Local dev & corp-TLS gotchas (this laptop)
- `source .aws-local/env.sh` before aws/terraform/kubectl (project-scoped creds, profile `trm`,
  us-west-2). It now also sets **AWS_CA_BUNDLE** (Python AWS CLI) and **NODE_EXTRA_CA_CERTS**
  (Node AWS SDK / mint-token) → corp CA, keeping TLS verification ON.
- `source .localdev.sh` before `npm run dev` (sets NODE_EXTRA_CA_CERTS for the app's Infura fetch).
- **NEVER** use `NODE_TLS_REJECT_UNAUTHORIZED=0` / SSL-disable flags — use the CA bundle.
  The corp CA is irrelevant in the container/EKS/CI (no interception there).
- gitignored secrets: `.env`, `.aws-local/`, `.localdev.sh`, `CONTEXT.md`.

## Operating it
- Hit staging: get NLB host (`kubectl get svc trm-eth-explorer -n staging -o jsonpath=...`),
  `TOKEN=$(APP_SECRET_ID=trm-eth-explorer/app node scripts/mint-token.js)`, curl with
  `Authorization: Bearer $TOKEN`. Real funded addrs: vitalik `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`,
  Beacon deposit `0x00000000219ab540356cBB839Cbe05303d7705Fa`.
- Promote to prod: `gh workflow run "Deploy to production (manual)" -f image_tag=<sha>`.
- Full go-live + teardown checklist in CONTEXT.md. Teardown: `helm uninstall` both namespaces
  (removes NLBs) THEN `terraform destroy`. Cost ~$7/day up.

## Current live state (as of this session)
- Infra applied (65 resources). **staging + prod both DEPLOYED + verified** (real authenticated
  balance calls return 200; no-token → 401, wrong-scope → 403; HPA/PDB active; metrics-server
  working). OIDC immutable-sub bug found + fixed.
- Merged PRs #1–#14 (latest #14: short-TTL in-memory balance cache). 51 tests pass.
- README.md + CLAUDE.md tracked via the docs PR; NOTES.md held untracked; CONTEXT.md gitignored.

## Working agreements
- Commits: single line, human voice, **no AI co-author trailer**.
- **Branch + PR for everything; never commit directly to main; Isaac merges all PRs himself.**
- Never commit/push or apply infra without explicit go-ahead. `terraform plan` reviewed by hand.
- MVP first, then hardening; small reviewable changes. Human voice everywhere.
