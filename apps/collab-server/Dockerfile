# Simple, workspace-aware image (dev/staging)
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=4000

WORKDIR /app

# Enable corepack (pnpm)
RUN corepack enable

# Copy workspace files first (better layer cache)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY apps/collab-server/package.json apps/collab-server/package.json

# Copy sources
COPY apps ./apps
COPY packages ./packages

# Install and build only what we need
RUN pnpm i --frozen-lockfile \
 && pnpm -C apps/collab-server build

EXPOSE 4000

CMD ["node", "apps/collab-server/dist/index.js"]


