# Build stage
FROM node:20-alpine AS builder

ENV NODE_ENV=production
WORKDIR /repo

# Enable corepack to use pnpm
RUN corepack enable

# Copy only files necessary for installing dependencies first (better cache)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps ./apps
COPY shared ./shared

# Install dependencies and build only the editor app
RUN corepack prepare pnpm@10.19.0 --activate && \
    pnpm install --frozen-lockfile && \
    pnpm build:editor


# Runtime stage
FROM nginx:1.27-alpine AS runtime

ENV NODE_ENV=production

# Copy nginx config and built assets
COPY apps/editor/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/apps/editor/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]


