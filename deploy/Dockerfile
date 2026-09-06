# syntax=docker/dockerfile:1

# ---- builder: resolve production dependencies only --------------------------
# Full Node image so npm is available. We install prod deps here and copy just the
# resolved node_modules into the runtime stage, so no npm, dev deps, or build
# toolchain ever ship in the final image.
FROM node:22-bookworm-slim AS builder
WORKDIR /app
# Copy manifests first so this layer caches unless dependencies actually change.
COPY package.json package-lock.json ./
# npm ci = clean, lockfile-exact install. --omit=dev drops test/lint deps.
# The optional `corp_ca` secret lets local builds behind a TLS-intercepting proxy
# trust the corporate root CA at build time only — it never enters an image layer,
# and TLS verification stays ON (no NODE_TLS_REJECT_UNAUTHORIZED). CI/prod builds
# pass no secret and use the public certificate chain.
RUN --mount=type=secret,id=corp_ca \
    if [ -f /run/secrets/corp_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/corp_ca; fi; \
    npm ci --omit=dev --no-audit --no-fund

# ---- runtime: distroless, non-root, no shell, no package manager -----------
# glibc-based distroless matches the bookworm builder. Node 22 (LTS) — the nodejs18
# variant is barely maintained (Node 18 is EOL), so its base packages (e.g. openssl)
# go stale and fail image scans; the maintained LTS base ships current patches. The
# :nonroot tag runs as an unprivileged user (uid 65532) by default; USER is set
# explicitly below so the non-root guarantee survives a base-tag change. No shell/apt
# means an attacker with RCE can't spawn /bin/sh or install tooling; debug via
# `kubectl debug` ephemeral containers instead of shelling into the runtime image.
FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
ENV NODE_ENV=production

# Production dependencies from the builder, then the application source only.
COPY --from=builder /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

USER nonroot
EXPOSE 3000

# The distroless nodejs image's ENTRYPOINT is `node`, so CMD passes only the script.
CMD ["src/server.js"]
