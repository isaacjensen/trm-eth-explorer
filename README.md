# trm-eth-explorer

An HTTP service that returns the current ETH balance of an Ethereum address, read from
Ethereum mainnet via Infura, deployed on EKS via Terraform with a GitHub Actions
CI/CD pipeline (OIDC, no static keys). MVP written in Node.js with Express. Lots of things i would do with more time, outlined below. Excited to share.

```
GET /address/balance/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
→ { "balance": 6.7121501618314605 }
```

## Endpoints
| Route | Purpose | Auth |
|-------|---------|------|
| `GET /address/balance/:address` | ETH balance for the address | bearer JWT (when enabled) |
| `GET /healthz` | liveness | none |
| `GET /readyz` | readiness (does not call upstream) | none |
| `GET /metrics` | Prometheus metrics | none |

## Architecture

This is the MVP architecture, deliberately minimal to serve a single endpoint in a demo:
```
client ── HTTP ──▶ NLB (public, L4) ──▶ Service ──▶ pod (private subnet)
                                                     │ requireAuth (authZ in the service) → controller → service
                                                     └─▶ ethRpc ──▶ Infura (eth_getBalance)
pods reach Infura/ECR outbound via NAT. EKS control plane is AWS-managed.
```
In production, once this grows into multiple APIs in the Express app hitting different
backend services, the edge changes: an API Gateway with WAF attached fronts everything.
WAF handles rate limiting, and a Lambda authorizer is invoked on every request at the
gateway to verify authentication/authorization before traffic reaches any service, so
authZ is centralized at the edge, not re-implemented per service. My MVP does authZ in the
service layer (`requireAuth`) only because it's a single endpoint in a demo setting. The
NLB → Service path would sit behind that gateway.
- App is layered so it's easy to extend and easy for AI to change safely:
  `routes/` (path → controller) → `controllers/` (HTTP concerns) → `services/` (domain) →
  `utils/ethRpc` (JSON-RPC transport: 3s timeout, 1 bounded retry, typed `UpstreamError`).
- Auth: bearer JWT verified in `middleware/auth.js` (HS256 + `balance:read` scope), fails
  closed in production.
- Infra (`deploy/terraform/`): VPC, EKS (1.34), ECR, GitHub OIDC role, Secrets Manager, KMS.
- CI/CD (`.github/workflows/`): PR = lint/test/build/Trivy; merge = build → ECR → deploy
  staging → smoke; prod = manual promotion of the tested image.

## Run locally
```bash
cp .env.example .env      # set INFURA_API_KEY
npm install
npm run dev               # or npm start
curl localhost:3000/address/balance/0xc94770007dda54cF92009BFF0dE90c06F603a09f
npm test && npm run lint
```
---

## Assumptions / shortcuts
- Doesnt need to support prod traffic, hence no external caching. MVP is using NLB, no certs, no custom hostname,
  to 'get this working', not worrying about full production-grade networking setup.
- Balance is a JSON number to match the spec's example (`{ "balance": 0.0001365 }`, an
  unquoted value = a JSON number). Conversion is exact end-to-end (`BigInt` → `formatEther`
  string); the single loss-prone step is the `Number()` cast at the HTTP boundary, which loses
  precision beyond ~16 significant figures (visible on huge balances, e.g. the Beacon deposit
  contract's ~9e7 ETH). A `wei` string field is the lossless fix.
- Balance read at block `latest` (chain tip, can reorg). Fine for an explorer, deeply correct 
  callers would want `finalized`. Something I didn't have a lot of context on, learned via AI.
- Address validation is format-only (`0x`+40 hex), not EIP-55 checksum, so the prompt's
  non-canonical casing isn't rejected; `eth_getBalance` is case-insensitive anyway. Another piece i did not understand before this work, I didn't fully grasp the implications of EIP-55 checksum and its role in address validation.
- Readiness does not call Infura, probing upstream every few seconds would burn the shared
  quota and flap; smoke tests + error-rate metrics cover upstream health instead.
  Readiness doesnt call this, but staging tests in CI still hit the API and make sure Infura is responding properly.
- Auth uses HS256 with a shared secret (self-contained for the demo). Production would verify
  RS256 against an IdP's JWKS. There is no token-issuing service, `scripts/mint-token.js` stands
  in for one locally. Just for MVP im storing hs256 secret in Secrets Manager, using it for tokens.
- NLB over HTTP, no TLS, deliberate scope cut. Production terminates TLS at an ALB (ACM cert)
  and forwards HTTP to pods in the private VPC. Weekend project did not seem like i needed to get certs etc.
- Terraform uses local state and is applied by hand (not in CI). Fine for a solo MVP; a team
  would use S3 remote state + a gated infra pipeline. MVP decision here too. No S3 bucket holding remote state as there would be in Prod.
- CPU-based HPA, simple and demoable; this service is I/O-bound (waits on Infura), so
  request-rate/concurrency is the better production autoscaling signal.
- Prod approval gate is a manual `workflow_dispatch`, GitHub required-reviewer environment
  protection needs a paid plan on private repos, so a deliberate manual promotion is the gate. Auto deploy to Staging, test
  then manually kick off Prod. GH Premium Plan lets you prompt admins to approve successful staging deployments.
- EKS + Helm chosen over Fargate/App Runner to demonstrate the operability surface I'd own
  in production (HPA, PDB, rolling deploys, IRSA, pod security), a named tradeoff, not a default. I use EKS at Trellix daily,
  have written end to end containers orchestrated by K8/helm. I followed same spec here with a helm chart and deployment on EKS.

## What I'd do next with more time
- PR environment for CI. Each pull request gets its own ephemeral environment for testing, ensuring changes are validated in isolation before merging. This would add support for doing CI for infra changes safely.
- Return balance losslessly: keep the JSON `balance` number for the contract, add an exact
  `wei` string field so no client is forced through a lossy double. This would be an ease of use addition for
  our more 'serious' players.
- TLS + custom DNS: ACM cert (https) + Route53 friendly names, forwarding traffic through our new
- Per-tenant analytics so we can understand if features are working broadly, or some custom setups are getting latency/issues.
- Formal Staging/Preprod/Prod environments. Only Staging + Prod for the MVP. Meant to show a testing ground before prod.
- Spruce error codes, verbose messages for better debugging and client feedback.
APIGW + WAF, then to services. Much more manageable, especially for scaling and security.
- API Gateway + WAF at the edge: as this grows into multiple APIs hitting different backend
  services, front the whole thing with an API Gateway (WAF attached). WAF rate-based rules /
  usage plans handle rate limiting (protecting the shared Infura quota and per-client fairness),
  and a Lambda authorizer verifies authN/authZ on every request at the gateway, centralizing
  it at the edge instead of re-implementing per service.
- Real auth: verify RS256 against an IdP (Okta/Keycloak) JWKS instead of a shared secret. No statis HS256 key
- Autoscaling on the right signal: move HPA from CPU to request-rate/latency via the Prometheus
  adapter or KEDA. This pod we wrote isnt CPU bound. It parses params, calls Infura API, responds. The HPA scale should be based on request rate or latency, not CPU.
- Observability: Prometheus + Grafana + alerts on `balance_requests_total{outcome}` and
  latency; structured-log aggregation; OpenTelemetry tracing. Possibly an ELK stack here could work too, but not sure searchability is needed.
  would give us searchability via elasticsearch. Need to understand if this is wanted or not.
- Infra pipeline: S3 remote state + plan-on-PR (read-only role) + apply-on-approval (write
  role) via Terraform , plus policy-as-code (tfsec/checkov) and drift detection. Some kind of ability to deploy your
  infra, then roll it back once PR finishes could be very beneficial. Some kind of CI logic where we terraform plan/apply,
  run tests, then roll back to master branch level infra via state file. Once PR is merged, then it becomes master and the changes persist.
- Dedicated env clusters
  Our environments are scoped to namespaces currerntly. In Prod, we would use clusters in different accounts for Staging/Prod to isolate resources and improve security and resource management.

- Progressive delivery: canary/blue-green (Argo Rollouts/Flagger) to catch prod-only bugs.
We have a staging environment here, that is used to validate PRs after merge via auto deploy. When we go to Prod,
there needs to be a proper deployment strategy, such as canary or blue-green deployments, to ensure stability and minimize risk. Cant just swap environments to point at new code altogether. Percentage rollout, regional etc.
- Caching: short-TTL cache (ElastiCache/Redis) of balances to cut Infura load and
  enable higher scale. Common addresses would get cached, reducing repeated calls to Infura.
  Highly transacted-upon addressses would require a short TTL since we wouldnt want to return
  out of date data. It's important to understand that Infura is the bottleneck in this currently. Good caching on our side of the Infura responses for hot addresses is critical. Caching adds problems because we need the TTL to be careful. We want accurate balances always.
- MULTI PROVIDER: consider supporting multiple Ethereum providers (Infura, Alchemy, etc.) to improve reliability and reduce dependency on a single provider. This would help us with not having a SPOF and not overload Infura
- Supply chain: SBOM + image signing (cosign); pin GitHub Actions to commit SHAs, etc. Mature Prod supply chain
practices should be followed. This service would require CVE SLA, timely patching etc.

## AI tools used

Primary tool: Claude Code (using model Opus 4.8 1M Context!), driven with a persistent project context file
(`CLAUDE.md`), scoped per-chunk prompts, per-chunk PRs, and a test/lint/plan/scan harness as the
verification loop. AI helped in many of the main points of this work, but was made sure to be omitted when dealing with secrets.

### Examples
1. Service + Jest suite, the Express app factory, fail-fast config,
   the Infura JSON-RPC wrapper (explicit timeout + bounded retry + typed `UpstreamError`), and
   the tests (validation, provider retry/timeout, route status mapping). Im used to REST APIs, so learning
   this new format is cool and seems standard for crypto APIs. I used ideas from my previous work to make the actual fetch client
   passable, so for tests, i can mock EASILY.
2. Infrastructure & deploy, Terraform for VPC/EKS/ECR/SM + GitHub OIDC role,
   the multi-stage distroless Dockerfile, the Helm chart (hardened securityContext, HPA, PDB), and
   the GitHub Actions pipelines. I went over all terraform, made sure to do indvidual files for all resources. Helm chart is modeled by environemt-specific values and security contexts like run as non root, read only filesystem etc. In memory cache is used for performance.
4. CI
  Setup CI with Claude for PRs, including automated linting, testing, and security scans. After PR is merged, we kick off a Staging env deploy. All policy docs were setup in least privledge, 0 access keys, only OIDC trust policy between GH Actions and AWS. CI needs Secrets Manager, add SM GET scope. CI needs this... add that... Always Least Privledge. No hard access tokens in loops ever.
3. Debugging, For example, deploys failed at `sts:AssumeRoleWithWebIdentity: Not
   authorized`. Used AI to  inspect the (correct-looking) trust policy, ruled out
   propagation, then decoded the actual OIDC token on a throwaway branch and found GitHub issues
   immutable-ID subjects (`repo:isaacjensen@11186577/trm-eth-explorer@1358620534:...`), not the
   plain `repo:owner/repo` we'd pinned, then fixed the trust policy (which is also more secure).
   Also, service level errors coming from AI output are re-rolled into prompts, so we build context based on things that failed too.
   Started including tests in every change to verify output consistenly against app code.

### How I verified outputs
- Unit/integration tests (Jest + supertest) and ESLint on every app change.
- `terraform plan` reviewed by hand before every apply; `helm lint` + `helm template`
  rendered and inspected before deploying.
- Trivy image scanning in CI; diff review on every PR (each chunk is a small, reviewable PR).
I wanted to add free, basic scanning.
- Smoke tests, an in-cluster authenticated balance call in the pipeline (asserts a real
  200), plus manual external calls against the live NLB with real funded addresses.

### One example where AI was wrong
- Stale, costly default: AI defaulted the EKS version to `1.31`, which had aged into
  extended support, ~6× the control-plane
- Incorrect filesystem readability. AI wanted to put all files in a lib dir, which makes it hard for AI to understand flow. Ive seen many times in past
  where it misses burried files. I added Routers/Controllers/Service with utils for smaller things.
- Non-existent dependency version: AI pinned `aquasecurity/trivy-action@0.24.0` (doesn't
  exist), then a version whose transitive `setup-trivy` tag had been deleted, CI failed twice.
  I resolved it by querying the real release tags and pinning `v0.36.0`.
- Incorrect (ish) assumption: the AI-drafted OIDC trust policy assumed the standard
  subject format and failed silently against GitHub's immutable-ID subjects (see debugging example
  above), caught by decoding the real token, not by trusting the code.

### One place I intentionally did NOT use AI
- The `terraform plan` review before every apply. I read the plan myself and decide what infra
  gets created/changed, AI doesn't get to. (This mattered in practice: a plan I expected to be a
  1-line change had also picked up node-group drift; reading it caught that before applying.)
- Secret management
  For this work, i wanted to show off my security approach, so added basic auth to the endpoint with a JWT carrying a scope.
  I wanted real auth, so i needed a token to sign keys with. That is stored in secrets manager and would get removed in Prod in favor
  of mature, JWKS signature verification.

## Security highlights
- No static AWS keys in CI, GitHub OIDC → a least-privilege role (ECR push + `eks:Describe`
  + `GetSecretValue` on specific ARNs; no `ec2:*`/`iam:*`/`eks:Create*`), trust locked to this
  repo's immutable ID + `main`/`staging`/`production` subjects (no wildcards).
- CI can deploy the app but cannot touch infra (Terraform is out of CI), small blast radius.
- Secrets: Secrets Manager → k8s Secret (KMS-encrypted at rest) → pod env; never in git/logs.
- Hardened runtime: distroless non-root image, read-only rootfs, dropped caps, seccomp.
- Auth fails closed in production; rollback via readiness-gated rolling updates + `helm rollback`. Wouldnt get this with single k8 template.
