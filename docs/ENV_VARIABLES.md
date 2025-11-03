# Zmienne Środowiskowe - Produkcja

## 📋 Frontend (Vercel) - Wymagane Zmienne

### 1. `VITE_API_URL` ⚠️ **WYMAGANE**
- **Opis:** URL do backend API (net-server) - **MUSI zawierać `/api` na końcu!**
- **Przykład:** `https://your-backend.railway.app/api` lub `https://your-backend.example.com/api`
- **⚠️ WAŻNE:** Backend ma wszystkie route'y pod prefiksem `/api`, więc URL musi kończyć się na `/api`
- **Gdzie ustawić:** Vercel Dashboard → Settings → Environment Variables → Production
- **Zabezpieczenie:** Nie jest secretem, może być publiczny (to URL API)

---

## 🔒 Backend (net-server) - Wymagane Zmienne

### 1. `JWT_SECRET` 🔐 **KRYTYCZNE - WYMAGANE**
- **Opis:** Secret key do podpisywania JWT tokenów
- **Wymagania:** 
  - Minimum 32 znaki
  - Minimum 8 unikalnych znaków (entropy)
  - **NIE MOŻE** być wartością domyślną `change-me-in-production`
- **Jak wygenerować:**
  ```bash
  # Linux/Mac
  openssl rand -base64 32
  
  # PowerShell (Windows)
  [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
  
  # Node.js
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- **Gdzie ustawić:** Na platformie gdzie wdrożony jest backend (Railway/etc.)
- **Zabezpieczenie:** 🔴 **SECRET** - NIGDY nie commituj do git!

### 2. `JWT_REFRESH_SECRET` 🔐 **ZALECANE**
- **Opis:** Secret key do podpisywania refresh tokenów (opcjonalne, domyślnie: `JWT_SECRET + '-refresh'`)
- **Wymagania:** Jak wyżej (min 32 znaki, min 8 unikalnych)
- **Jak wygenerować:** Jak wyżej
- **Zabezpieczenie:** 🔴 **SECRET**

### 3. `FRONTEND_URL` ⚠️ **WYMAGANE W PRODUKCJI**
- **Opis:** URL frontendu (używane do CORS)
- **Przykład:** `https://your-app.vercel.app` lub `https://your-app.vercel.app,https://your-custom-domain.com`
- **Format:** Może być wiele URLi oddzielonych przecinkami
- **Zabezpieczenie:** Może być publiczny (to URL frontendu)

### 4. `NODE_ENV` ⚠️ **WYMAGANE**
- **Wartość:** `production`
- **Zabezpieczenie:** Publiczny

### 5. `DATABASE_URL` 📊 **OPCJONALNE (ale zalecane)**
- **Opis:** Connection string do PostgreSQL
- **Format:** `postgresql://user:password@host:port/database?sslmode=require`
- **Uwaga:** W produkcji **WYMAGANY** `sslmode=require` dla bezpieczeństwa
- **Gdzie wziąć:** 
  - Railway: W settings → Database → Connection String
  - Inne: Skonfiguruj własną bazę PostgreSQL
- **Zabezpieczenie:** 🔴 **SECRET** - zawiera hasło do bazy!

---

## 📋 Backend - Opcjonalne Zmienne (z wartościami domyślnymi)

### 6. `PORT`
- **Domyślna:** `3000`
- **Opis:** Port na którym działa HTTP server

### 7. `WS_PORT`
- **Domyślna:** `3001`
- **Opis:** Port na którym działa WebSocket server

### 8. `DATA_DIR`
- **Domyślna:** `./data`
- **Opis:** Katalog dla danych JSON (jeśli nie używasz bazy)

### 9. `AUTH_RATE_LIMIT_MAX`
- **Domyślna:** `5`
- **Opis:** Maksymalna liczba requestów auth na 15 minut
- **Zalecana wartość:** `5` (zachowaj domyślną)

### 10. `ECONOMY_RATE_LIMIT_MAX`
- **Domyślna:** `20`
- **Opis:** Maksymalna liczba requestów economy na minutę

### 11. `BCRYPT_ROUNDS`
- **Domyślna:** `12`
- **Opis:** Liczba rund hashowania bcrypt (większa = bezpieczniejsze, ale wolniejsze)

### 12. `JWT_EXPIRES_IN`
- **Domyślna:** `15m`
- **Opis:** Czas wygaśnięcia JWT tokena

### 13. `JWT_REFRESH_EXPIRES_IN`
- **Domyślna:** `7d`
- **Opis:** Czas wygaśnięcia refresh tokena

### Economy Settings (opcjonalne)
- `ECONOMY_MIN_PRICE_CREDITS` (domyślnie: `0.1`)
- `ECONOMY_PRICE_CHANGE_COOLDOWN_SEC` (domyślnie: `3600`)
- `ECONOMY_LISTING_FEE_CREDITS` (domyślnie: `0.1`)
- `ECONOMY_PLATFORM_FEE_BPS` (domyślnie: `800` = 8%)
- `ECONOMY_PRICE_MULTIPLIER` (domyślnie: `1`)

---

## 🚀 Instrukcje Setup - Vercel (Frontend)

1. **Otwórz Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Wybierz projekt

2. **Przejdź do Settings → Environment Variables**

3. **Dodaj zmienne:**
   ```
   VITE_API_URL = https://your-backend-url.com/api
   ```
   - ⚠️ Zamień `your-backend-url.com` na rzeczywisty URL backendu
   - ⚠️ **WAŻNE:** URL musi kończyć się na `/api` (backend ma wszystkie route'y pod `/api`)

4. **Wybierz środowiska:**
   - ✅ Production
   - ✅ Preview (opcjonalnie)

5. **Zapisz i zrób redeploy:**
   - Zmiany w env variables wymagają redeploy
   - Możesz kliknąć "Redeploy" w Deployment

---

## 🔒 Instrukcje Setup - Backend na Railway

### Konfiguracja Railway:

1. **Otwórz Railway Dashboard:**
   - https://railway.app
   - **New Project** → **Deploy from GitHub**
   - Wybierz repozytorium z projektem

2. **Dodaj PostgreSQL Database:**
   - W projekcie kliknij **"+ New"** → **"Database"** → **"PostgreSQL"**
   - Railway automatycznie utworzy bazę i ustawi `DATABASE_URL`
   - Railway automatycznie dodaje `sslmode=require`
   
   **Uwaga:** Railway pokaże informacje o bazie:
   - HTTP Domain (np. `net-server-db-production.up.railway.app`) - używane wewnętrznie
   - TCP Proxy endpoints - opcjonalne, do ręcznego połączenia lokalnego
   - **Nie musisz używać tych endpointów ręcznie** - Railway automatycznie ustawia `DATABASE_URL` w serwisie

3. **Dodaj zmienne w Variables:**
   - Przejdź do serwisu `net-server` → **Variables**
   - Kliknij **"+ New Variable"** i dodaj:
   ```
   NODE_ENV=production
   JWT_SECRET=<wygeneruj używając node scripts/generate-jwt-secret.js>
   JWT_REFRESH_SECRET=<wygeneruj używając node scripts/generate-jwt-secret.js>
   FRONTEND_URL=https://your-app.vercel.app
   ```
   - **Uwaga:** `DATABASE_URL` powinien być już automatycznie ustawiony przez Railway

4. **Generowanie publicznego URL:**
   - Przejdź do serwisu → **Settings** → **Networking**
   - Kliknij **"Generate Domain"**
   - Railway wygeneruje URL w formacie: `https://net-server-production.up.railway.app`
   - **Dodaj `/api` na końcu:** `https://net-server-production.up.railway.app/api`
   - Ten URL (z `/api`) będzie potrzebny do ustawienia `VITE_API_URL` w Vercel

---

## ⚠️ Checklist Bezpieczeństwa

### ✅ Przed deployem upewnij się, że:

- [ ] `JWT_SECRET` jest **minimum 32 znaki** i **nie jest wartością domyślną**
- [ ] `JWT_REFRESH_SECRET` jest ustawiony (jeśli używasz osobnego)
- [ ] `FRONTEND_URL` wskazuje na **dokładny URL** twojego frontendu (bez wildcardów `*`)
- [ ] `DATABASE_URL` zawiera `sslmode=require` (dla PostgreSQL)
- [ ] `NODE_ENV=production` jest ustawione
- [ ] Wszystkie **secrets są w Environment Variables**, **NIE w kodzie**
- [ ] `.env` pliki są w `.gitignore`
- [ ] Nie commitujesz secrets do git

### 🔐 Secrets (nigdy nie commituj):
- ✅ `JWT_SECRET`
- ✅ `JWT_REFRESH_SECRET`
- ✅ `DATABASE_URL`
- ✅ Hasła do baz danych

### Publiczne zmienne (OK do commit):
- ✅ `FRONTEND_URL`
- ✅ `NODE_ENV`
- ✅ `VITE_API_URL` (w Vercel env vars)

---

## 🔍 Weryfikacja Konfiguracji

Backend automatycznie waliduje konfigurację przy starcie. Sprawdź logi:

```bash
# Po deploymencie backendu sprawdź logi:
# Jeśli widzisz:
✅ Configuration validation passed

# Jeśli widzisz:
❌ Configuration validation failed:
   - JWT_SECRET must be at least 32 characters long
```

---

## 📚 Dodatkowe Informacje

- **Walidacja konfiguracji:** `apps/net-server/src/config/validateConfig.ts`
- **Przykładowa konfiguracja:** Zobacz dokumentację deployment dla wybranej platformy
- **Dokumentacja API:** Backend ma endpoint `/health` do sprawdzenia statusu

---

## 🆘 Troubleshooting

### Błąd: "JWT_SECRET must be at least 32 characters"
**Rozwiązanie:** Wygeneruj nowy secret używając komend powyżej i ustaw go w env variables.

### Błąd: "CORS error" w przeglądarce
**Rozwiązanie:** Upewnij się, że `FRONTEND_URL` w backendzie zawiera dokładny URL frontendu (z `https://`).

### Błąd: "405 Method Not Allowed" na `/auth/register` lub innych endpointach
**Rozwiązanie:** 
1. Sprawdź czy backend jest wdrożony i działa (`curl https://your-backend.railway.app/api/health`)
2. Ustaw `VITE_API_URL` w Vercel na URL backendu **z `/api` na końcu** (np. `https://your-backend.railway.app/api`)
3. Zrób redeploy frontendu (zmiany w env variables wymagają redeploy)
4. Sprawdź w DevTools → Network czy request idzie do poprawnego URL (powinien być `https://your-backend.railway.app/api/auth/register`)

### Błąd: "Database connection failed"
**Rozwiązanie:**
1. Sprawdź czy `DATABASE_URL` jest prawidłowy
2. Upewnij się, że baza ma `sslmode=require` w produkcji
3. Sprawdź czy baza jest dostępna z IP backendu (whitelist)

