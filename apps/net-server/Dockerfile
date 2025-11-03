# Multi-stage build for optimized production image
FROM node:22-alpine AS base

# Enable corepack (pnpm)
RUN corepack enable

# Install build dependencies (wasm-pack)
FROM base AS builder

# Install curl and tar (required for wasm-pack download)
RUN apk add --no-cache curl tar

# Install wasm-pack (required for @engine/wasm-collision build)
# Using latest stable version
RUN curl -LO https://github.com/rustwasm/wasm-pack/releases/download/v0.12.1/wasm-pack-v0.12.1-x86_64-unknown-linux-musl.tar.gz \
 && tar -xzf wasm-pack-v0.12.1-x86_64-unknown-linux-musl.tar.gz \
 && mv wasm-pack-v0.12.1-x86_64-unknown-linux-musl/wasm-pack /usr/local/bin/ \
 && chmod +x /usr/local/bin/wasm-pack \
 && rm -rf wasm-pack-v0.12.1-x86_64-unknown-linux-musl*

WORKDIR /app

# Copy workspace configuration files first (better layer cache)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY apps/net-server/package.json apps/net-server/package.json

# Copy package.json files from all packages (for dependency resolution)
COPY packages/*/package.json ./packages/

# Install dependencies (production + dev for build)
RUN pnpm i --frozen-lockfile

# Copy source code
COPY apps ./apps
COPY packages ./packages
COPY shared ./shared

# Build required packages for net-server (recursive -r automatically builds dependencies)
RUN pnpm --filter "@engine/core" --filter "@engine/animation" --filter "@engine/blocks" --filter "@engine/world" --filter "@engine/world-server" --filter "@engine/economy" --filter "@engine/script" -r build

# Generate Prisma client before build
RUN pnpm -C apps/net-server db:generate

# Build the application
RUN pnpm -C apps/net-server build

# Production image - minimal dependencies
FROM base AS runner

ENV NODE_ENV=production \
    PORT=3000 \
    WS_PORT=3001

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nodejs

# Copy workspace configuration
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-lock.yaml ./
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Copy package.json files for dependency resolution
COPY --from=builder --chown=nodejs:nodejs /app/apps/net-server/package.json ./apps/net-server/
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages

# Copy only built application
COPY --from=builder --chown=nodejs:nodejs /app/apps/net-server/dist ./apps/net-server/dist

# Copy only production node_modules (from builder stage)
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Prune dev dependencies (keep only production)
RUN pnpm prune --prod

# Switch to non-root user
USER nodejs

EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "apps/net-server/dist/server.js"]

