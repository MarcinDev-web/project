# Zmienne Środowiskowe - Produkcja

## 📋 Frontend (Vercel) - Wymagane Zmienne

### 1. `VITE_API_URL` ⚠️ **WYMAGANE**
- **Opis:** URL do backend API (net-server)
- **Przykład:** `https://your-backend.railway.app` lub `https://your-backend.render.com`
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
- **Gdzie ustawić:** Na platformie gdzie wdrożony jest backend (Render/Railway/etc.)
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
  - Render: Automatycznie generowane dla PostgreSQL service
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
   VITE_API_URL = https://your-backend-url.com
   ```
   - ⚠️ Zamień `your-backend-url.com` na rzeczywisty URL backendu

4. **Wybierz środowiska:**
   - ✅ Production
   - ✅ Preview (opcjonalnie)

5. **Zapisz i zrób redeploy:**
   - Zmiany w env variables wymagają redeploy
   - Możesz kliknąć "Redeploy" w Deployment

---

## 🔒 Instrukcje Setup - Backend (Render/Railway/etc.)

### Przykład dla Render.com:

1. **Otwórz Render Dashboard**
2. **Utwórz Web Service:**
   - **Build Command:** `pnpm install && pnpm --filter @apps/net-server build`
   - **Start Command:** `node apps/net-server/dist/server.js`
   - **Environment:** `Node`

3. **Dodaj Environment Variables:**
   ```
   NODE_ENV = production
   JWT_SECRET = <wygeneruj-64-znakowy-secret>
   JWT_REFRESH_SECRET = <wygeneruj-64-znakowy-secret>
   FRONTEND_URL = https://your-app.vercel.app
   DATABASE_URL = <connection-string-z-render>
   ```

4. **Utwórz PostgreSQL Database:**
   - Render automatycznie wygeneruje `DATABASE_URL`
   - Dodaj `?sslmode=require` na końcu jeśli nie ma

### Przykład dla Railway.app:

1. **Otwórz Railway Dashboard**
2. **New Project → Deploy from GitHub**
3. **Dodaj zmienne w Variables:**
   ```
   NODE_ENV=production
   JWT_SECRET=<wygeneruj>
   JWT_REFRESH_SECRET=<wygeneruj>
   FRONTEND_URL=https://your-app.vercel.app
   ```

4. **Dodaj PostgreSQL Database:**
   - Railway automatycznie ustawi `DATABASE_URL`

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
- **Przykładowa konfiguracja:** Zobacz `render.yaml` dla przykładu Render.com
- **Dokumentacja API:** Backend ma endpoint `/health` do sprawdzenia statusu

---

## 🆘 Troubleshooting

### Błąd: "JWT_SECRET must be at least 32 characters"
**Rozwiązanie:** Wygeneruj nowy secret używając komend powyżej i ustaw go w env variables.

### Błąd: "CORS error" w przeglądarce
**Rozwiązanie:** Upewnij się, że `FRONTEND_URL` w backendzie zawiera dokładny URL frontendu (z `https://`).

### Błąd: "405 Method Not Allowed" na `/api/*`
**Rozwiązanie:** 
1. Sprawdź czy backend jest wdrożony i działa
2. Ustaw `VITE_API_URL` w Vercel na URL backendu
3. Zrób redeploy frontendu

### Błąd: "Database connection failed"
**Rozwiązanie:**
1. Sprawdź czy `DATABASE_URL` jest prawidłowy
2. Upewnij się, że baza ma `sslmode=require` w produkcji
3. Sprawdź czy baza jest dostępna z IP backendu (whitelist)

