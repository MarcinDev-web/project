# Docker Hub i Railway - Jak działają aktualizacje

## 🔄 Proces aktualizacji

### 1. **Lokalne zmiany Docker** → **Docker Hub**
❌ **NIE automatycznie** - musisz ręcznie pushować obrazy

**Jak zaktualizować Docker Hub:**
```powershell
# Windows PowerShell
.\scripts\docker-push.ps1 -DockerHubUsername "twoja-nazwa" -Tag "latest"

# Linux/Mac
./scripts/docker-push.sh twoja-nazwa latest
```

Ten skrypt:
1. Buduje obrazy Docker z najnowszymi zmianami
2. Taguje je z Twoją nazwą użytkownika Docker Hub
3. Pushuje do Docker Hub

---

### 2. **Docker Hub** → **Railway**
Zależy od konfiguracji Railway:

#### Opcja A: Railway builduje z Git (domyślne) ✅
- Railway automatycznie rebuilduje przy każdym `git push`
- Nie potrzebujesz Docker Hub
- Railway używa Dockerfile z repozytorium

**Konfiguracja:**
- Railway → Project Settings → Source → GitHub repo
- Railway automatycznie wykrywa Dockerfile i buduje

#### Opcja B: Railway używa Docker Hub
- Musisz ręcznie pushować obrazy do Docker Hub
- Railway pobiera obrazy z Docker Hub
- Wymaga konfiguracji w Railway Settings

---

## 📋 Zalecany workflow

### Dla Railway (build z Git) - **NAJPROSTSZE**:
```bash
# 1. Zmiany lokalne
git add .
git commit -m "Update Docker config"
git push

# 2. Railway automatycznie:
# - Wykrywa push
# - Rebuilduje z Dockerfile
# - Deployuje nową wersję
```

### Dla Docker Hub:
```powershell
# 1. Zmiany lokalne
docker-compose build net-server

# 2. Push do Docker Hub
.\scripts\docker-push.ps1 -DockerHubUsername "twoja-nazwa"

# 3. Railway (jeśli używa Docker Hub):
# - Musisz ręcznie zrestartować deployment
# - Lub skonfigurować auto-pull z Docker Hub
```

---

## 🔍 Sprawdź konfigurację Railway

1. **Railway Dashboard** → Twój projekt → Settings
2. Sprawdź **Source**:
   - ✅ **GitHub repo** = Railway builduje z Git (automatycznie)
   - ❌ **Docker Hub** = Musisz pushować ręcznie

---

## 💡 Rekomendacja

**Używaj Railway z Git** (domyślne):
- ✅ Automatyczny deploy przy każdym push
- ✅ Nie potrzebujesz Docker Hub
- ✅ Prostsze w utrzymaniu
- ✅ Railway automatycznie wykonuje migracje (jeśli skonfigurowane)

**Docker Hub używaj tylko jeśli:**
- Chcesz udostępnić obrazy publicznie
- Używasz Railway z Docker Hub jako źródła
- Masz CI/CD który pushuje do Docker Hub

---

## 🔐 Sekrety i zmienne środowiskowe (PROD)

- Nie używaj wartości domyślnych z `docker-compose.yml` w produkcji (np. `JWT_SECRET`, `DATABASE_URL`).
- Dla Railway: ustaw sekrety w Project → Variables (np. `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`).
- Dla Vercel: Project Settings → Environment Variables.
- Dla własnej infrastruktury: użyj `docker run -e ...` lub `docker-compose.override.yml` z `.env` poza repo.
- Minimalny zestaw zmiennych dla serwerów:
  - `JWT_SECRET`, `JWT_REFRESH_SECRET`
  - `DATABASE_URL`
  - `CORS_ALLOWED_ORIGINS`, `ALLOWED_ORIGINS`
  - `PORT`, `WS_PORT` (jeśli dotyczy)

