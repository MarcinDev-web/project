# Multi-stage build for optimized production image
FROM node:22-alpine AS base

# Enable corepack (pnpm)
RUN corepack enable

# Build stage
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
COPY apps/collab-server/package.json apps/collab-server/package.json

# Copy package.json files from all packages (for dependency resolution)
# Preserve directory structure by copying each package directory's package.json
COPY packages/core/package.json ./packages/core/
COPY packages/world/package.json ./packages/world/
COPY packages/animation/package.json ./packages/animation/
COPY packages/economy/package.json ./packages/economy/
COPY packages/blocks/package.json ./packages/blocks/
COPY packages/gfx-webgpu/package.json ./packages/gfx-webgpu/
COPY packages/input/package.json ./packages/input/
COPY packages/stdlib/package.json ./packages/stdlib/
COPY packages/editor-utils/package.json ./packages/editor-utils/
COPY packages/test-utils/package.json ./packages/test-utils/
COPY packages/net-protocol/package.json ./packages/net-protocol/
COPY packages/net-server/package.json ./packages/net-server/
COPY packages/gateway/package.json ./packages/gateway/
COPY packages/script/package.json ./packages/script/
COPY packages/camera/package.json ./packages/camera/
COPY packages/voxel/package.json ./packages/voxel/
COPY packages/world-server/package.json ./packages/world-server/
COPY packages/brand/package.json ./packages/brand/
COPY packages/wasm-collision/package.json ./packages/wasm-collision/
COPY packages/avatar/package.json ./packages/avatar/
COPY packages/microblocks/package.json ./packages/microblocks/
COPY packages/net/package.json ./packages/net/
COPY packages/world-templates/package.json ./packages/world-templates/

# Install dependencies (production + dev for build)
RUN pnpm install --no-frozen-lockfile --prefer-offline

# Copy built packages and applications
COPY packages ./packages
COPY apps/collab-server ./apps/collab-server
COPY shared ./shared
COPY scripts ./scripts

# Reinstall dependencies to ensure workspace links are correct after copying source files
RUN pnpm install --no-frozen-lockfile --prefer-offline

# Generate Prisma client (dummy DATABASE_URL for client generation)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm -C apps/collab-server db:generate

# Build TypeScript (required for Railway deployment)
# Clean dist folders and build info files first to avoid overwrite errors
# Use pnpm filters to build dependencies, then handle circular dependency with script
# Build world without script reference (tsconfig.build.json), then rebuild script with world available
RUN find packages -type d -name dist -exec rm -rf {} + 2>/dev/null || true && \
    find packages -name "*.tsbuildinfo" -delete 2>/dev/null || true && \
    pnpm --filter @engine/core build && \
    pnpm --filter @engine/animation build && \
    pnpm --filter @engine/blocks build && \
    pnpm --filter @engine/economy build && \
    (cd packages/world && pnpm exec tsc -b tsconfig.build.json) && \
    pnpm --filter @engine/net-protocol build && \
    pnpm --filter @engine/net-server build && \
    pnpm -C apps/collab-server build

# Note: bundling with tsup produces correct ESM with .js extensions and avoids alias rewriting

# Production image - minimal dependencies
FROM base AS runner

# Install OpenSSL for Prisma (required for Prisma engines)
# Alpine Linux uses openssl3, but Prisma may need compatibility libraries
RUN apk add --no-cache openssl openssl-dev || apk add --no-cache openssl

ENV NODE_ENV=production \
    PORT=4000

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nodejs

# Copy workspace configuration
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-lock.yaml ./
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Copy package.json files for dependency resolution
COPY --from=builder --chown=nodejs:nodejs /app/apps/collab-server/package.json ./apps/collab-server/
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages
COPY --from=builder --chown=nodejs:nodejs /app/shared ./shared

# Install production dependencies
RUN CI=true pnpm install --no-frozen-lockfile --prod

# Copy generated Prisma client from builder stage
# Prisma client is generated at apps/node_modules/.prisma/collab-client (relative to prisma folder: ../../node_modules)
# Must copy after pnpm install to ensure node_modules directory exists
# Create .prisma directory if it doesn't exist (in case Prisma client wasn't generated)
RUN mkdir -p ./node_modules/.prisma
COPY --from=builder --chown=nodejs:nodejs /app/apps/node_modules/.prisma/collab-client ./node_modules/.prisma/collab-client

# Create symlink for @prisma/client to find the client (it looks for .prisma/client/default)
# The @prisma/client package expects the client at .prisma/client/default, but we have it at .prisma/collab-client
RUN mkdir -p ./node_modules/.prisma/client && \
    ln -sf ../collab-client ./node_modules/.prisma/client/default || \
    cp -r ./node_modules/.prisma/collab-client ./node_modules/.prisma/client/default

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/apps/collab-server/dist ./apps/collab-server/dist

# Prune dev dependencies (keep only production)
RUN CI=true pnpm prune --prod

# Switch to non-root user
USER nodejs

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "apps/collab-server/dist/index.js"]


