# Wdrożenie net-server na Railway

## 🚀 Szybki Start

### 1. Utworzenie projektu

1. **Przejdź na Railway.app:**
   - Zaloguj się: https://railway.app
   - Kliknij **"New Project"** → **"Deploy from GitHub"**
   - Wybierz repozytorium z tym projektem

2. **Railway automatycznie wykryje projekt:**
   - Railway wykryje Node.js monorepo
   - Może automatycznie zaproponować konfigurację

### 2. Konfiguracja serwisu net-server

1. **Jeśli Railway nie wykrył automatycznie:**
   - Kliknij **"+ New"** w projekcie
   - Wybierz **"GitHub Repo"** → wybierz to samo repozytorium
   - Railway utworzy nowy serwis

2. **Skonfiguruj Build & Deploy:**
   - Przejdź do serwisu → **Settings** → **Build & Deploy**
   - **Build Command:** `pnpm i --frozen-lockfile && pnpm -w --filter @apps/net-server build`
   - **Start Command:** `node apps/net-server/dist/server.js`
   - **Root Directory:** *(zostaw puste - monorepo root)*

3. **Ustaw Node.js version (opcjonalnie):**
   - W **Settings** → **Build & Deploy** możesz ustawić **Node Version**
   - Zalecane: `18.x` lub `20.x`

### 3. Dodanie PostgreSQL Database

1. **W projekcie Railway kliknij "+ New":**
   - Wybierz **"Database"** → **"PostgreSQL"**
   - Railway automatycznie utworzy bazę

2. **Railway pokaże informacje o bazie:**
   - **HTTP Domain:** `net-server-db-production.up.railway.app`
     - Używane wewnętrznie przez Railway
     - Nie musisz tego używać ręcznie
   - **TCP Proxy endpoints:** (np. `interchange.proxy.rlwy.net:17882`)
     - Do ręcznego połączenia z bazą (pgAdmin, DBeaver, psql)
     - Opcjonalne - tylko jeśli potrzebujesz połączyć się lokalnie
     - Railway automatycznie dostarcza connection string w `DATABASE_URL`

3. **Railway automatycznie:**
   - Ustawi zmienną `DATABASE_URL` w serwisie `net-server`
   - Doda `sslmode=require` do connection string
   - Udostępni bazę dla wszystkich serwisów w projekcie
   - **Nie musisz ręcznie konfigurować połączenia** - Railway to robi automatycznie

---

## 🔒 Wymagane Zmienne Środowiskowe

Dodaj w Railway Dashboard → Twój serwis → **Variables**:

### **WYMAGANE:**

1. **`NODE_ENV`:**
   - **Value:** `production`

2. **`JWT_SECRET`:**
   - **Value:** *(wygeneruj używając `node scripts/generate-jwt-secret.js`)*
   - Minimum 32 znaki

3. **`JWT_REFRESH_SECRET`:**
   - **Value:** *(wygeneruj używając `node scripts/generate-jwt-secret.js`)*
   - Minimum 32 znaki

4. **`FRONTEND_URL`:**
   - **Value:** `https://your-app.vercel.app`
   - *(zastąp swoim URL frontendu z Vercel)*
   - Może być wiele URLi oddzielonych przecinkami: `https://app1.vercel.app,https://app2.vercel.app`

### **PostgreSQL Database:**
✅ **Railway automatycznie:**
- Utworzy bazę i ustawi `DATABASE_URL` po dodaniu PostgreSQL Database
- Doda `sslmode=require` do connection string
- Udostępni zmienną wszystkim serwisom w projekcie

**Sprawdź w Variables:** Po dodaniu bazy powinieneś zobaczyć `DATABASE_URL` automatycznie ustawione.

---

## 🔐 Generowanie JWT Secrets

Użyj jednej z komend:

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# PowerShell (Windows)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Linux/Mac
openssl rand -base64 32
```

**Ważne:** Secrets muszą mieć minimum 32 znaki!

---

## ✅ Weryfikacja

Po deploymencie:

1. **Sprawdź logi:**
   - Powinno być: `✅ Configuration validation passed`
   - Jeśli widzisz błędy, sprawdź zmienne środowiskowe

2. **Test endpointu:**
   ```bash
   curl https://your-net-server.railway.app/health
   ```
   Powinno zwrócić: `{"status":"ok"}`

3. **Test API:**
   ```bash
   curl https://your-net-server.railway.app/api/auth/register \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123456"}'
   ```

---

## 🔗 Ustawienie VITE_API_URL w Vercel

Po udanym deploymencie net-server:

1. **Skopiuj URL backendu:**
   - Przejdź do dashboardu platformy → net-server
   - Skopiuj URL (np. `https://net-server-xyz.railway.app`)

2. **Dodaj w Vercel:**
   - Vercel Dashboard → Twój projekt → Settings → Environment Variables
   - **Key:** `VITE_API_URL`
   - **Value:** `https://net-server-xyz.railway.app`
   - **Environments:** ✅ Production, ✅ Preview (opcjonalnie)
   - Zapisz

3. **Redeploy:**
   - Przejdź do Deployments
   - Kliknij "..." na najnowszym deployment
   - Wybierz "Redeploy"

---

## 🐛 Troubleshooting

### Błąd: "Configuration validation failed"
**Problem:** JWT_SECRET nie spełnia wymagań  
**Rozwiązanie:** Wygeneruj nowy secret (min 32 znaki, min 8 unikalnych)

### Błąd: "Database connection failed"
**Problem:** DATABASE_URL nieprawidłowy lub brak SSL  
**Rozwiązanie:** 
- Sprawdź czy Railway automatycznie dodała `DATABASE_URL` po utworzeniu PostgreSQL Database
- Railway automatycznie dodaje `sslmode=require`, więc nie musisz tego robić ręcznie
- Jeśli nie widzisz `DATABASE_URL`, upewnij się że baza została dodana do projektu

### Błąd: "CORS error" w przeglądarce
**Problem:** FRONTEND_URL nie zawiera dokładnego URL frontendu  
**Rozwiązanie:** 
- Zaktualizuj `FRONTEND_URL` w Railway Variables: `https://your-app.vercel.app`
- Railway automatycznie zrestartuje serwis po zmianie zmiennych

### Błąd: "Build failed"
**Problem:** Zależności nie mogą być zainstalowane  
**Rozwiązanie:**
- Sprawdź czy `pnpm-lock.yaml` jest w repo
- Sprawdź logi build w Railway Dashboard (Deployments → View Logs)
- Upewnij się że build command jest prawidłowy: `pnpm i --frozen-lockfile && pnpm -w --filter @apps/net-server build`

---

## 📚 Dodatkowe Informacje o Railway

- **Health Check:** Railway automatycznie monitoruje serwis (możesz ustawić custom health check path `/health`)
- **Auto Deploy:** Włączone domyślnie - Railway deployuje przy każdym push do głównej branchy
- **Logs:** Dostępne w Railway Dashboard → Deployments → View Logs lub bezpośrednio w sekcji Logs
- **Metrics:** Railway pokazuje użycie CPU, RAM, network w czasie rzeczywistym
- **Custom Domain:** Możesz dodać własną domenę w Settings → Networking → Custom Domain

---

## 🔄 Aktualizacja FRONTEND_URL

Gdy zmienisz URL frontendu w Vercel:

1. Zaktualizuj `FRONTEND_URL` w Railway Variables
2. Railway automatycznie zrestartuje serwis

**Uwaga:** Railway automatycznie restartuje serwis po zmianie zmiennych środowiskowych - nie musisz robić tego ręcznie.

