# Multi-stage build for optimized production image
FROM node:22-alpine AS base

# Enable corepack (pnpm)
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

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
RUN pnpm install --no-frozen-lockfile --prefer-offline

# Copy built packages and applications
COPY packages ./packages
COPY apps/net-server ./apps/net-server
COPY shared ./shared
COPY scripts ./scripts

# Reinstall dependencies to ensure workspace links are correct after copying source files
RUN pnpm install --no-frozen-lockfile --prefer-offline

# Generate Prisma client (dummy DATABASE_URL for client generation)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm -C apps/net-server db:generate

# Build TypeScript (required for Railway deployment)
# Build core and world first (foundation), then the app (which will build its dependencies)
# Exclude test-utils, gateway, script, camera, and editor-utils from build as they're not needed in production
RUN pnpm -w --filter @engine/core build && \
    pnpm -w --filter @engine/world build && \
    pnpm -w --filter '@apps/net-server...' --filter '!@engine/test-utils' --filter '!@engine/gateway' --filter '!@engine/script' --filter '!@engine/camera' --filter '!@engine/editor-utils' build

# Replace TypeScript path aliases with relative paths using tsc-alias
# Also fix Prisma imports to use correct relative paths for dist structure
# From src/storage/ (../../) to dist/apps/net-server/src/storage/ (../../../../../)
# Also add .js extensions to relative imports that are missing them
RUN pnpm add -D -w tsc-alias && \
    pnpm exec tsc-alias -p apps/net-server/tsconfig.json --resolve-full-paths && \
    find apps/net-server/dist -name "*.js" -type f -exec sed -i "s|from '../../node_modules/.prisma/net-client/index.js'|from '../../../../../node_modules/.prisma/net-client/index.js'|g" {} \; && \
    find apps/net-server/dist -name "*.js" -type f -exec sed -i "s|from '../../../node_modules/.prisma/net-client/index.js'|from '../../../../../../node_modules/.prisma/net-client/index.js'|g" {} \; && \
    find apps/net-server/dist -name "*.js" -type f -exec sed -i "s|from './index'|from './index.js'|g" {} \; && \
    find apps/net-server/dist -name "*.js" -type f -exec sed -i "s|from '../index'|from '../index.js'|g" {} \; && \
    find apps/net-server/dist -name "*.js" -type f -exec sed -i "s|from '../../index'|from '../../index.js'|g" {} \; && \
    find apps/net-server/dist -name "*.js" -type f -exec sed -i "s|from '../../../index'|from '../../../index.js'|g" {} \; && \
    find apps/net-server/dist -name "*.js" -type f -exec sed -i "s|from '../../../../index'|from '../../../../index.js'|g" {} \; && \
    find apps/net-server/dist -name "*.js" -type f -exec sed -i "s|from './types'|from './types.js'|g" {} \; && \
    find apps/net-server/dist -name "*.js" -type f -exec sed -i "s|from '../types'|from '../types.js'|g" {} \; && \
    find apps/net-server/dist -name "*.js" -type f -exec sed -i "s|from '../../types'|from '../../types.js'|g" {} \; && \
    pnpm remove -w tsc-alias

# Also fix imports in packages (they might be imported by the app)
# Fix missing .js extensions in relative imports
# Use Node.js script to reliably add .js extensions to relative imports
RUN node -e "const fs=require('fs'),path=require('path');function fixImports(dir){const files=fs.readdirSync(dir,{withFileTypes:true});for(const file of files){const fullPath=path.join(dir,file.name);if(file.isDirectory())fixImports(fullPath);else if(file.name.endsWith('.js')&&fullPath.includes('/dist/')){let content=fs.readFileSync(fullPath,'utf8');const original=content;content=content.replace(/from\\s+['\"](\\.[^'\"]+)(?!\\.js)['\"]/g,(m,p)=>m.replace(p,p+'.js'));content=content.replace(/\\.js\\.js/g,'.js');if(content!==original)fs.writeFileSync(fullPath,content);}}}fixImports('/app/packages');"

# Production image - minimal dependencies
FROM base AS runner

# Install OpenSSL for Prisma (required for Prisma engines)
RUN apk add --no-cache openssl openssl-dev || apk add --no-cache openssl

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
COPY --from=builder --chown=nodejs:nodejs /app/shared ./shared

# Install production dependencies and rebuild native modules
# Install build tools temporarily for native module compilation (bcrypt)
# pnpm ignores build scripts by default in CI, so we rebuild bcrypt manually
RUN apk add --no-cache --virtual .build-deps python3 make g++ && \
    CI=true pnpm install --no-frozen-lockfile --prod && \
    pnpm rebuild bcrypt --prod || find /app/node_modules/.pnpm -name "bcrypt" -type d -path "*/bcrypt@*/node_modules/bcrypt" -exec sh -c 'cd "{}" && npm rebuild' \; || true && \
    apk del .build-deps

# Copy generated Prisma client from builder stage
# Prisma client is generated at apps/net-server/node_modules/.prisma/net-client (relative to prisma folder)
COPY --from=builder --chown=nodejs:nodejs /app/apps/net-server/node_modules/.prisma ./apps/net-server/node_modules/.prisma

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/apps/net-server/dist ./apps/net-server/dist

# Copy Docker entrypoint for runtime checks
COPY --from=builder /app/apps/net-server/docker/entrypoint.sh ./apps/net-server/docker/entrypoint.sh
RUN chmod +x /app/apps/net-server/docker/entrypoint.sh

# Prune dev dependencies (keep only production)
RUN CI=true pnpm prune --prod

# Switch to non-root user
USER nodejs

# Change working directory to where server.js is located for correct relative imports
WORKDIR /app/apps/net-server/dist/apps/net-server/src

EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["/app/apps/net-server/docker/entrypoint.sh"]
CMD ["node", "server.js"]

