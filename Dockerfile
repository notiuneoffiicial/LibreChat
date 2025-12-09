# v0.8.0

# ---------- Base Node Image ----------
FROM node:20-alpine AS node

# Install dependencies
RUN apk add --no-cache jemalloc python3 py3-pip uv

# Set environment variable to use jemalloc
ENV LD_PRELOAD=/usr/lib/libjemalloc.so.2

# Add `uv` for extended MCP support
COPY --from=ghcr.io/astral-sh/uv:0.6.13 /uv /uvx /bin/
RUN uv --version

# Create and own /app directory
RUN mkdir -p /app && chown -R node:node /app
WORKDIR /app

# Switch to non-root user
USER node

# Copy package manifests
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node api/package.json ./api/package.json
COPY --chown=node:node client/package.json ./client/package.json
COPY --chown=node:node packages/data-provider/package.json ./packages/data-provider/package.json
COPY --chown=node:node packages/data-schemas/package.json ./packages/data-schemas/package.json
COPY --chown=node:node packages/api/package.json ./packages/api/package.json

# Install dependencies
RUN \
    # Allow mounting of these files, which have no default
    touch .env && \
    # Create directories for volumes to inherit correct permissions
    mkdir -p /app/client/public/images /app/api/logs /app/uploads && \
    npm config set fetch-retry-maxtimeout 600000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 15000 && \
    if [ ! -f package-lock.json ]; then npm install --package-lock-only --ignore-scripts; fi && \
    npm ci --no-audit

# Copy project files
COPY --chown=node:node . .

# Build frontend and prune dev dependencies
RUN \
    # React client build
    NODE_OPTIONS="--max-old-space-size=2048" npm run frontend && \
    npm prune --production && \
    npm cache clean --force

# ---------- Node API Setup ----------
EXPOSE 3080
ENV HOST=0.0.0.0

CMD ["npm", "run", "backend"]

# ---------- Optional: Nginx Static Client ----------
# FROM nginx:stable-alpine AS nginx-client
# WORKDIR /usr/share/nginx/html
# COPY --from=node /app/client/dist /usr/share/nginx/html
# COPY client/nginx.conf /etc/nginx/conf.d/default.conf
# ENTRYPOINT ["nginx", "-g", "daemon off;"]
