# syntax=docker/dockerfile:1

# Builder: full Node image (has npm) to install prod-only deps. The runtime stage copies
# just node_modules, so npm, dev deps, and build tools never ship in the final image.
FROM node:22-bookworm-slim AS builder
WORKDIR /app
# Copy manifests first so this layer caches unless dependencies change.
COPY package.json package-lock.json ./
# Exact, prod-only install. Optional corp_ca secret lets local builds trust the corp
# proxy CA at build time only (never baked in, TLS stays on); CI passes no secret.
RUN --mount=type=secret,id=corp_ca \
    if [ -f /run/secrets/corp_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/corp_ca; fi; \
    npm ci --omit=dev --no-audit --no-fund

# Runtime: distroless Node 22 LTS, non-root, no shell or package manager (small attack
# surface, clean scans; debug via `kubectl debug`, not by shelling in).
FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
ENV NODE_ENV=production

# Prod deps from the builder, then the app source.
COPY --from=builder /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

USER nonroot
EXPOSE 3000

# distroless nodejs ENTRYPOINT is `node`, so CMD is just the script.
CMD ["src/server.js"]
