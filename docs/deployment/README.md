# Deployment Documentation

Documentation for deploying Forge Engine applications to various platforms.

## 📋 Quick Links

### Platform Guides

- **[DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md)** - Quick deployment guide
- **[DEPLOYMENT_STEP_BY_STEP.md](DEPLOYMENT_STEP_BY_STEP.md)** - Step-by-step deployment
- **[START_PLATFORM.md](START_PLATFORM.md)** - Starting the platform locally

### Railway Deployment

- **[RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md)** - Complete Railway deployment guide
- **[RAILWAY_MIGRATION.md](RAILWAY_MIGRATION.md)** - Migration to Railway
- **[RAILWAY_INTEGRATION_CHECK.md](RAILWAY_INTEGRATION_CHECK.md)** - Integration verification
- **[RAILWAY_DEPLOYMENT_TEST_REPORT.md](RAILWAY_DEPLOYMENT_TEST_REPORT.md)** - Test report
- **[RAILWAY_DATABASE_INFO.md](RAILWAY_DATABASE_INFO.md)** - Database setup on Railway

### Vercel Deployment

- **[VERCEL_DEPLOY.md](VERCEL_DEPLOY.md)** - Vercel deployment guide
- **[VERCEL_DEPLOYMENT_TROUBLESHOOTING.md](VERCEL_DEPLOYMENT_TROUBLESHOOTING.md)** - Troubleshooting guide

### Docker

- **[DOCKER_DEPLOYMENT_GUIDE.md](DOCKER_DEPLOYMENT_GUIDE.md)** - Docker deployment setup
- **[DOCKER_COMPOSE_LOGS_ANALYSIS.md](DOCKER_COMPOSE_LOGS_ANALYSIS.md)** - Docker Compose logs analysis

### Database & Configuration

- **[MARKETPLACE_DATABASE_SETUP.md](MARKETPLACE_DATABASE_SETUP.md)** - Marketplace database setup
- **[DEPLOY_FORUM_DB_MIGRATION.md](DEPLOY_FORUM_DB_MIGRATION.md)** - Forum database migration
- **[DEPLOY_NET_SERVER.md](DEPLOY_NET_SERVER.md)** - Network server deployment
- **[ENV_VARIABLES.md](ENV_VARIABLES.md)** - Environment variables reference

---

## 🚀 Deployment Overview

### Applications

The project consists of several deployable applications:

1. **@apps/editor** - 3D scene editor (static site)
2. **@apps/player** - Game player client (static site)
3. **@apps/platform** - Platform web UI (static site)
4. **@apps/net-server** - API & database server (Node.js)
5. **@apps/collab-server** - Collaboration server (Node.js + WebRTC)

### Recommended Platforms

- **Frontend Apps** (editor, player, platform):
  - Vercel (recommended)
  - Netlify
  - Railway (static)
  
- **Backend Servers** (net-server, collab-server):
  - Railway (recommended)
  - Heroku
  - AWS/GCP/Azure
  - Docker containers

### Database

- **PostgreSQL** via Railway or external provider
- **Prisma ORM** for migrations and queries

---

## 🔧 Quick Start

### Local Development

```bash
# Install dependencies
pnpm install

# Build packages
pnpm build

# Start development servers
pnpm dev:editor     # Editor on http://localhost:5173
pnpm dev:platform   # Platform on http://localhost:5174
pnpm dev:server     # API server on http://localhost:3000
```

### Production Build

```bash
# Build all packages
pnpm build

# Build specific apps
pnpm build:editor
pnpm build:platform
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build
```

---

## 📚 Environment Variables

See **[ENV_VARIABLES.md](ENV_VARIABLES.md)** for complete reference.

**Required for net-server:**
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
NODE_ENV=production
```

**Required for platform:**
```env
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://ws.yourdomain.com
```

---

## 🔍 Troubleshooting

If you encounter deployment issues:

1. Check **[VERCEL_DEPLOYMENT_TROUBLESHOOTING.md](VERCEL_DEPLOYMENT_TROUBLESHOOTING.md)** for Vercel-specific issues
2. Review **[DOCKER_COMPOSE_LOGS_ANALYSIS.md](DOCKER_COMPOSE_LOGS_ANALYSIS.md)** for Docker issues
3. Verify environment variables in **[ENV_VARIABLES.md](ENV_VARIABLES.md)**
4. Check database connections in **[RAILWAY_DATABASE_INFO.md](RAILWAY_DATABASE_INFO.md)**

---

## 📝 Best Practices

1. **Always test locally first** - Use `pnpm dev` to verify changes
2. **Use environment-specific configs** - Different configs for dev/staging/prod
3. **Database migrations** - Run Prisma migrations before deploying
4. **Monitor logs** - Check application logs after deployment
5. **SSL/TLS** - Always use HTTPS in production

---

**Last Updated:** 2025-11-12  
**Maintained by:** Tech Team

