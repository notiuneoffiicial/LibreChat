# v0.8.0

# ---------- Base Build Stage ----------
FROM node:20-alpine AS builder

RUN apk add --no-cache jemalloc python3 py3-pip uv

ENV LD_PRELOAD=/usr/lib/libjemalloc.so.2

COPY --from=ghcr.io/astral-sh/uv:0.6.13 /uv /uvx /bin/
RUN uv --version

# Create and chown the working directory BEFORE switching user
RUN mkdir -p /app && chown -R node:node /app
WORKDIR /app

# Switch user AFTER directory ownership is set
USER node

# Copy dependency manifests
COPY --chown=node:node package*.json ./
COPY --chown=node:node api/package.json ./api/
COPY --chown=node:node client/package.json ./client/
COPY --chown=node:node packages/data-provider/package.json ./packages/data-provider/
COPY --chown=node:node packages/data-schemas/package.json ./packages/data-schemas/
COPY --chown=node:node packages/api/package.json ./packages/api/

# ✅ Make sure node can write to node_modules
RUN mkdir -p /app/node_modules && chown -R node:node /app

# Install all deps including dev
RUN npm ci --no-audit

# Copy full source
COPY --chown=node:node . .

# Build frontend
RUN NODE_OPTIONS="--max-old-space-size=2048" npm run frontend

# Strip dev deps
RUN npm prune --production && npm cache clean --force


# ---------- Runtime Stage ----------
FROM node:20-alpine AS runtime

RUN apk add --no-cache jemalloc
ENV LD_PRELOAD=/usr/lib/libjemalloc.so.2

WORKDIR /app
USER node

COPY --from=builder /app /app

# Ensure frontend exists
RUN test -f /app/client/dist/index.html || (echo "❌ client build missing" && exit 1)

EXPOSE 3080
ENV HOST=0.0.0.0
CMD ["npm", "run", "backend"]
