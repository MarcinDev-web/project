# Simple, workspace-aware image (dev/staging)
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    WS_PORT=3001

WORKDIR /app

# Enable corepack (pnpm)
RUN corepack enable

# Install wasm-pack (required for @engine/wasm-collision build)
RUN curl -LO https://github.com/rustwasm/wasm-pack/releases/download/v0.12.1/wasm-pack-v0.12.1-x86_64-unknown-linux-musl.tar.gz \
 && tar -xzf wasm-pack-v0.12.1-x86_64-unknown-linux-musl.tar.gz \
 && mv wasm-pack-v0.12.1-x86_64-unknown-linux-musl/wasm-pack /usr/local/bin/ \
 && chmod +x /usr/local/bin/wasm-pack \
 && rm -rf wasm-pack-v0.12.1-x86_64-unknown-linux-musl*

# Copy workspace files first (better layer cache)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY apps/net-server/package.json apps/net-server/package.json

# Copy sources
COPY apps ./apps
COPY packages ./packages

# Install and build only what we need
RUN pnpm i --frozen-lockfile \
 && pnpm -C apps/net-server build

EXPOSE 3000 3001

CMD ["node", "apps/net-server/dist/server.js"]

