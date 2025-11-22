# ⚡ Automation Quick Start

Szybki przewodnik po uruchomieniu automatyzacji platformy.

## 🚀 Szybki Start (5 minut)

### 1. Dependabot - Automatyczne Aktualizacje

**Status:** ✅ Gotowe do użycia

Dependabot jest już skonfigurowany w `.github/dependabot.yml`. Automatycznie:
- Tworzy PR z aktualizacjami zależności co tydzień
- Grupuje podobne aktualizacje
- Uruchamia testy w PR

**Akcja:** Brak - działa automatycznie po commit do main.

---

### 2. Auto-Deployment

**Status:** ⚙️ Wymaga konfiguracji secrets

**Kroki:**

1. **Vercel Setup:**
   ```bash
   # Zainstaluj Vercel CLI
   npm i -g vercel
   
   # Zaloguj się
   vercel login
   
   # Linkuj projekty
   cd apps/platform && vercel link
   cd apps/editor && vercel link
   ```

2. **Dodaj Secrets do GitHub:**
   - Settings → Secrets and variables → Actions
   - Dodaj:
     - `VERCEL_TOKEN` - z `vercel whoami --token`
     - `VERCEL_ORG_ID` - z Vercel dashboard
     - `VERCEL_PLATFORM_PROJECT_ID` - z Vercel dashboard
     - `VERCEL_EDITOR_PROJECT_ID` - z Vercel dashboard

3. **Railway Setup:**
   - Railway dashboard → Settings → Generate Deploy Token
   - Dodaj do GitHub Secrets:
     - `RAILWAY_TOKEN`

**Użycie:**

```bash
# Automatyczny deployment po push do main
git push origin main

# Manualny deployment przez GitHub Actions UI
# Actions → Deploy to Production → Run workflow
```

---

### 3. Security Scanning

**Status:** ✅ Gotowe do użycia

Security scanning działa automatycznie:
- **Dependency Review** - przy każdym PR
- **NPM Audit** - przy push do main/develop
- **CodeQL** - cotygodniowe skanowanie

**Akcja:** Brak - działa automatycznie.

**Sprawdź wyniki:**
- Security tab w GitHub repo
- CodeQL alerts w Security → Code scanning alerts

---

### 4. Database Migrations

**Status:** ⚙️ Wymaga konfiguracji secrets

**Kroki:**

1. **Dodaj Database URLs do GitHub Secrets:**
   - Settings → Secrets and variables → Actions → Environments
   - Staging environment:
     - `STAGING_DATABASE_URL`
     - `STAGING_COLLAB_DATABASE_URL`
   - Production environment:
     - `PRODUCTION_DATABASE_URL`
     - `PRODUCTION_COLLAB_DATABASE_URL`

2. **Konfiguruj Environments:**
   - Settings → Environments
   - Utwórz "staging" i "production"
   - Dodaj protection rules dla production (wymagaj review)

**Użycie:**

```bash
# Automatyczne migracje po zmianie schematu Prisma
git push origin main  # Jeśli zmieniono apps/*/prisma/**

# Manualne migracje przez GitHub Actions UI
# Actions → Database Migrations → Run workflow
# Wybierz environment i wpisz "confirm"
```

---

## 📋 Checklist Konfiguracji

### Vercel Deployment
- [ ] Vercel CLI zainstalowane
- [ ] Projekty zlinkowane (`vercel link`)
- [ ] `VERCEL_TOKEN` w GitHub Secrets
- [ ] `VERCEL_ORG_ID` w GitHub Secrets
- [ ] `VERCEL_PLATFORM_PROJECT_ID` w GitHub Secrets
- [ ] `VERCEL_EDITOR_PROJECT_ID` w GitHub Secrets

### Railway Deployment
- [ ] Railway account utworzone
- [ ] Projekty skonfigurowane w Railway
- [ ] `RAILWAY_TOKEN` w GitHub Secrets

### Database Migrations
- [ ] Environments utworzone (staging, production)
- [ ] `STAGING_DATABASE_URL` w Secrets
- [ ] `STAGING_COLLAB_DATABASE_URL` w Secrets
- [ ] `PRODUCTION_DATABASE_URL` w Secrets (protected)
- [ ] `PRODUCTION_COLLAB_DATABASE_URL` w Secrets (protected)

### Security Scanning
- [ ] CodeQL enabled (automatycznie)
- [ ] Dependency Review enabled (automatycznie)
- [ ] Security tab dostępny w repo

---

## 🧪 Testowanie Automatyzacji

### Test Dependabot
```bash
# Dependabot automatycznie utworzy PR w poniedziałek
# Możesz przetestować manualnie przez GitHub UI:
# Settings → Code security and analysis → Dependabot → Enable
```

### Test Auto-Deployment
```bash
# 1. Zrób małą zmianę w apps/platform
echo "// test" >> apps/platform/src/App.tsx

# 2. Commit z flagą deploymentu
git commit -m "test: deployment [deploy:platform]"

# 3. Push do main
git push origin main

# 4. Sprawdź GitHub Actions
# Actions → Deploy to Production → Sprawdź logi
```

### Test Security Scanning
```bash
# 1. Utwórz PR z dodaniem zależności
# 2. Sprawdź Dependency Review w PR
# 3. Sprawdź Security tab po merge
```

### Test Database Migrations
```bash
# 1. Utwórz nową migrację Prisma
cd apps/net-server
pnpm prisma migrate dev --name test_migration

# 2. Commit i push
git add apps/net-server/prisma
git commit -m "test: database migration"
git push origin main

# 3. Sprawdź GitHub Actions
# Actions → Database Migrations → Sprawdź logi
```

---

## 🔧 Troubleshooting

### Deployment nie działa

**Problem:** Vercel deployment fails

**Rozwiązanie:**
```bash
# Sprawdź Vercel token
vercel whoami

# Sprawdź project ID
cd apps/platform
vercel link  # Pokaże project ID

# Sprawdź GitHub Secrets
# Settings → Secrets → VERCEL_TOKEN, VERCEL_ORG_ID, etc.
```

### Database migrations nie działają

**Problem:** Migrations fail z błędem połączenia

**Rozwiązanie:**
```bash
# Sprawdź Database URL format
# Powinien być: postgresql://user:password@host:port/database

# Sprawdź czy database jest dostępny
psql $DATABASE_URL -c "SELECT 1"

# Sprawdź GitHub Secrets
# Settings → Secrets → STAGING_DATABASE_URL
```

### Security scanning nie działa

**Problem:** CodeQL nie skanuje

**Rozwiązanie:**
```bash
# Włącz CodeQL w repo
# Settings → Code security and analysis → Code scanning → Set up

# Sprawdź czy workflow jest włączony
# Actions → Security Scan → Enable workflow
```

---

## 📚 Więcej Informacji

- [AUTOMATION_ROADMAP.md](./AUTOMATION_ROADMAP.md) - Pełny plan automatyzacji
- [TESTING_AUTOMATION.md](./TESTING_AUTOMATION.md) - Test automation guide
- [DEPLOYMENT_STEP_BY_STEP.md](./deployment/DEPLOYMENT_STEP_BY_STEP.md) - Deployment guide

---

**Ostatnia aktualizacja:** 2025-01-26

