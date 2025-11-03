# 🚀 Szybki Przewodnik Deploymentu - Vercel + Railway

## 📋 Co Będziemy Robić

1. ✅ **JWT Secrets** - już wygenerowane (zapisz je!)
2. 🚂 **Backend na Railway** - wdrożenie `net-server` z PostgreSQL
3. 🌐 **Frontend na Vercel** - wdrożenie `apps/platform`
4. 🔗 **Konfiguracja połączenia** - ustawienie zmiennych środowiskowych

---

## 🔐 Krok 1: Zapisz JWT Secrets

**Wygenerowane secrets:**
```
JWT_SECRET=8Bh3X2LByCdf0sOXWjvymqXcIRjYtWbXsZK6fNTHyag=
JWT_REFRESH_SECRET=1poHIGmi6uLcrEjBErjAg5olxwsirUxwpJuHYyJ2xkI=
```

**⚠️ ZAPISZ TE WARTOŚCI** - będą potrzebne w kroku 3!

---

## 🚂 Krok 2: Wdrożenie Backendu na Railway

### 2.1. Utworzenie Projektu Railway

1. **Otwórz:** https://railway.app
2. **Zaloguj się** (GitHub)
3. **Kliknij:** "New Project" → "Deploy from GitHub"
4. **Wybierz** repozytorium z tym projektem

### 2.2. Konfiguracja Serwisu net-server

Railway powinien automatycznie wykryć monorepo. Jeśli nie:

1. **"+ New"** → **"GitHub Repo"** → wybierz repo
2. Railway utworzy serwis

**Ustawienia Build & Deploy:**
- Przejdź: **Settings** → **Build & Deploy**
- **Build Command:** 
  ```bash
  curl -LO https://github.com/rustwasm/wasm-pack/releases/download/v0.12.1/wasm-pack-v0.12.1-x86_64-unknown-linux-musl.tar.gz && tar -xzf wasm-pack-v0.12.1-x86_64-unknown-linux-musl.tar.gz && mv wasm-pack-v0.12.1-x86_64-unknown-linux-musl/wasm-pack /usr/local/bin/ && pnpm i --frozen-lockfile && pnpm -w --filter @apps/net-server build
  ```
- **Start Command:** `node apps/net-server/dist/server.js`
- **Root Directory:** *(zostaw puste)*

**⚠️ Ważne:** Build command pobiera i instaluje `wasm-pack` (wymagane do buildu pakietu `@engine/wasm-collision`). Jeśli build nadal się nie powiedzie, zobacz sekcję Troubleshooting poniżej.

### 2.3. Dodanie PostgreSQL Database

1. W projekcie kliknij **"+ New"**
2. Wybierz **"Database"** → **"PostgreSQL"**
3. ✅ Railway automatycznie:
   - Utworzy bazę
   - Ustawi `DATABASE_URL` w serwisie `net-server`
   - Doda `sslmode=require`

**Sprawdź:** W serwisie `net-server` → **Variables** powinieneś zobaczyć `DATABASE_URL`

---

## 🔒 Krok 3: Konfiguracja Zmiennych Środowiskowych (Railway)

W Railway Dashboard → `net-server` → **Variables** → **"+ New Variable"**

Dodaj wszystkie zmienne:

| Key | Value | Uwagi |
|-----|-------|-------|
| `NODE_ENV` | `production` | |
| `JWT_SECRET` | `8Bh3X2LByCdf0sOXWjvymqXcIRjYtWbXsZK6fNTHyag=` | Z kroku 1 |
| `JWT_REFRESH_SECRET` | `1poHIGmi6uLcrEjBErjAg5olxwsirUxwpJuHYyJ2xkI=` | Z kroku 1 |
| `FRONTEND_URL` | `https://your-app.vercel.app` | **Ustawisz później** (po deploy frontendu) |
| `DATABASE_URL` | *(automatycznie ustawione)* | ✅ Railway dodało przy dodaniu PostgreSQL |

**Uwaga:** `FRONTEND_URL` możesz ustawić później po wdrożeniu frontendu. Railway zrestartuje serwis automatycznie.

---

## 🌐 Krok 4: Wdrożenie Frontendu na Vercel

### 4.1. Połącz Projekt z Vercel

**Opcja A: Przez Vercel Dashboard (Zalecane)**

1. **Otwórz:** https://vercel.com/dashboard
2. **"Add New"** → **"Project"**
3. **Import Git Repository** → wybierz repozytorium
4. Vercel wykryje konfigurację z `vercel.json`

**Opcja B: Przez Vercel CLI**

```bash
# Jeśli nie masz Vercel CLI:
npm i -g vercel

# W katalogu projektu:
vercel
```

### 4.2. Konfiguracja Vercel

Vercel automatycznie użyje konfiguracji z `vercel.json`:
- **Build Command:** `pnpm build:platform`
- **Output Directory:** `apps/platform/dist`
- **Framework Preset:** Vite (automatycznie)

**Sprawdź:**
- **Root Directory:** *(zostaw puste - monorepo root)*
- Vercel powinien wykryć `vercel.json` i `pnpm-workspace.yaml`

### 4.3. Pierwszy Deploy

1. **Kliknij:** "Deploy"
2. **Poczekaj** na zakończenie build
3. **Skopiuj URL** - będzie w formacie: `https://your-app-xyz.vercel.app`
4. **Zapisz ten URL** - potrzebny w następnym kroku!

---

## 🔗 Krok 5: Konfiguracja Połączenia Frontend ↔ Backend

### 5.1. Ustawienie FRONTEND_URL w Railway

1. W Railway Dashboard → `net-server` → **Variables**
2. **Zaktualizuj** `FRONTEND_URL`:
   - **Value:** `https://your-app-xyz.vercel.app` *(URL z kroku 4.3)*
3. Railway automatycznie zrestartuje serwis

### 5.2. Ustawienie VITE_API_URL w Vercel

1. W Vercel Dashboard → Twój projekt → **Settings** → **Environment Variables**
2. **"+ Add"** → Dodaj:
   - **Key:** `VITE_API_URL`
   - **Value:** `https://your-net-server.railway.app/api` **⚠️ WAŻNE: Musi zawierać `/api` na końcu!**
   - **Environments:** ✅ Production, ✅ Preview (opcjonalnie)
3. **Zapisz**

**Przykład poprawnej wartości:**
```
https://net-server-production.up.railway.app/api
```

### 5.3. Generowanie Publicznego URL Backendu (Railway)

Jeśli jeszcze nie masz publicznego URL:

1. Railway Dashboard → `net-server` → **Settings** → **Networking**
2. **"Generate Domain"** (jeśli przycisk dostępny)
3. **Skopiuj URL** - np. `https://net-server-production.up.railway.app`
4. **Dodaj `/api` na końcu** - np. `https://net-server-production.up.railway.app/api`
5. **Użyj tego URL z `/api`** w `VITE_API_URL` w Vercel (krok 5.2)

---

## 🔄 Krok 6: Redeploy Frontendu

Po ustawieniu `VITE_API_URL`:

1. Vercel Dashboard → **Deployments**
2. Kliknij **"..."** na najnowszym deployment
3. Wybierz **"Redeploy"**
4. ✅ Gotowe!

---

## ✅ Krok 7: Weryfikacja

### 7.1. Test Backendu

```bash
curl https://your-net-server.railway.app/health
```

**Powinno zwrócić:** `{"status":"ok"}`

### 7.2. Test Frontendu

1. Otwórz: `https://your-app.vercel.app`
2. Przejdź do `/register`
3. Spróbuj zarejestrować użytkownika
4. **Nie powinno być błędu 405!**

### 7.3. Sprawdź Network Tab (DevTools)

1. DevTools → **Network**
2. Spróbuj zarejestrować użytkownika
3. Request do `/api/auth/register` powinien:
   - ✅ Mieć status **201** (Created) lub **400** (Validation Error)
   - ❌ **NIE** powinien mieć **405** (Method Not Allowed)

---

## 🐛 Troubleshooting

### Problem: Backend nie startuje - "Configuration validation failed"

**Sprawdź logi w Railway:**
- Railway Dashboard → `net-server` → **Logs**
- Szukaj komunikatu błędu

**Najczęstsze problemy:**
- ❌ `JWT_SECRET` za krótkie (< 32 znaki) → Użyj wartości z kroku 1
- ❌ `FRONTEND_URL` nie ustawione → Ustaw w kroku 5.1
- ❌ `DATABASE_URL` nieprawidłowy → Railway powinno ustawić automatycznie

### Problem: "405 Method Not Allowed" w frontendzie

**Sprawdź:**
1. ✅ Czy `VITE_API_URL` jest ustawione w Vercel?
2. ✅ Czy frontend był zrobiony redeploy PO dodaniu env variable?
3. ✅ Czy backend URL jest prawidłowy (testuj curl `/health`)

**Rozwiązanie:**
- Zaktualizuj `VITE_API_URL` w Vercel
- Zrób redeploy frontendu

### Problem: CORS errors w przeglądarce

**Sprawdź:**
- Czy `FRONTEND_URL` w Railway zawiera dokładny URL frontendu (z `https://`)
- Czy URL jest bez trailing slash

**Rozwiązanie:**
- Zaktualizuj `FRONTEND_URL` w Railway Variables
- Railway automatycznie zrestartuje serwis

### Problem: Build failed - "wasm-pack: not found"

**Błąd:** `sh: 1: wasm-pack: not found` podczas buildu na Railway

**Rozwiązanie:**
1. Upewnij się, że build command w Railway zawiera instalację `wasm-pack` (patrz Krok 2.2)
2. Alternatywnie, jeśli build command nie działa, możesz:
   - Dodać plik `apps/net-server/nixpacks.toml` (zobacz przykład w repo)
   - Lub użyć Dockerfile zamiast build command
3. Sprawdź logi buildu w Railway - czy `wasm-pack` został zainstalowany poprawnie

**Jeśli problem nadal występuje:**
- Sprawdź czy Railway używa odpowiedniego base image (Node.js 22)
- Możesz spróbować użyć Dockerfile zamiast build command (plik `apps/net-server/Dockerfile` w repo)

---

## 📚 Dodatkowe Dokumenty

- **[docs/ENV_VARIABLES.md](docs/ENV_VARIABLES.md)** - Pełna lista zmiennych środowiskowych
- **[docs/DEPLOY_NET_SERVER.md](docs/DEPLOY_NET_SERVER.md)** - Szczegóły deploy backendu
- **[docs/DEPLOYMENT_STEP_BY_STEP.md](docs/DEPLOYMENT_STEP_BY_STEP.md)** - Szczegółowy przewodnik

---

## 🎉 Gotowe!

Po wykonaniu wszystkich kroków:
- ✅ Frontend komunikuje się z backendem
- ✅ Rejestracja/login działają
- ✅ Wszystkie API endpoints są dostępne

**Następne kroki:**
- Skonfiguruj custom domain (opcjonalnie)
- Włącz monitoring w Railway
- Skonfiguruj backups dla PostgreSQL

