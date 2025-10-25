# v0.8.0

# ---------- Base Build Stage ----------
FROM node:20-alpine AS builder

# Install deps needed for build
RUN apk add --no-cache jemalloc python3 py3-pip uv

# Use jemalloc
ENV LD_PRELOAD=/usr/lib/libjemalloc.so.2

# Add `uv` binary
COPY --from=ghcr.io/astral-sh/uv:0.6.13 /uv /uvx /bin/
RUN uv --version

# Prepare work directory
RUN mkdir -p /app
WORKDIR /app
USER node

# Copy dependency manifests first for better caching
COPY --chown=node:node package*.json ./
COPY --chown=node:node api/package.json ./api/
COPY --chown=node:node client/package.json ./client/
COPY --chown=node:node packages/data-provider/package.json ./packages/data-provider/
COPY --chown=node:node packages/data-schemas/package.json ./packages/data-schemas/
COPY --chown=node:node packages/api/package.json ./packages/api/

# Install all dependencies (including dev)
RUN npm ci --no-audit

# Copy full source
COPY --chown=node:node . .

# Build frontend (this will produce client/dist)
RUN NODE_OPTIONS="--max-old-space-size=2048" npm run frontend

# Remove dev dependencies AFTER build so that the dist remains
RUN npm prune --production && npm cache clean --force


# ---------- Runtime Stage ----------
FROM node:20-alpine AS runtime

# jemalloc for better memory perf
RUN apk add --no-cache jemalloc
ENV LD_PRELOAD=/usr/lib/libjemalloc.so.2

WORKDIR /app
USER node

# Copy only what’s needed for runtime (no dev deps)
COPY --from=builder /app /app

# Ensure client build is present
RUN test -f /app/client/dist/index.html || (echo "ERROR: client build missing" && exit 1)

EXPOSE 3080
ENV HOST=0.0.0.0

# Launch backend
CMD ["npm", "run", "backend"]
