# Wdrożenie net-server na Render.com

## 🚀 Szybki Start

### Opcja 1: Użycie render.yaml (Rekomendowane)

Render automatycznie wykryje `render.yaml` w root repo i zaproponuje wdrożenie wszystkich serwisów.

1. **Przejdź na Render.com:**
   - Zaloguj się na https://render.com
   - Kliknij "New" → "Blueprint"

2. **Połącz z GitHub:**
   - Wybierz repozytorium z tym projektem
   - Render automatycznie wykryje `render.yaml`

3. **Zaktualizuj zmienne środowiskowe:**
   - Po utworzeniu serwisu, przejdź do Settings → Environment
   - **Ważne:** Zaktualizuj `FRONTEND_URL` na rzeczywisty URL Vercel:
     ```
     FRONTEND_URL=https://your-app.vercel.app
     ```

4. **Zapisz i poczekaj na deploy**

---

### Opcja 2: Ręczne wdrożenie

1. **Utwórz Web Service:**
   - Kliknij "New" → "Web Service"
   - Połącz z GitHub repo

2. **Konfiguracja Build:**
   - **Name:** `net-server`
   - **Environment:** `Node`
   - **Region:** `Frankfurt` (lub wybierz najbliższy)
   - **Branch:** `main` (lub twoja główna brancha)
   - **Root Directory:** *(zostaw puste - monorepo root)*

3. **Build & Start Commands:**
   - **Build Command:** `pnpm i --frozen-lockfile && pnpm -w --filter @apps/net-server build`
   - **Start Command:** `node apps/net-server/dist/server.js`

4. **Plan:** Starter (lub wyższy dla produkcji)

5. **Health Check Path:** `/health`

---

## 🔒 Wymagane Zmienne Środowiskowe

Dodaj w Settings → Environment:

### **WYMAGANE:**
```
NODE_ENV=production
JWT_SECRET=<wygeneruj-64-znakowy-secret>
JWT_REFRESH_SECRET=<wygeneruj-64-znakowy-secret>
FRONTEND_URL=https://your-app.vercel.app
```

### **PostgreSQL Database:**
Render automatycznie utworzy bazę i ustawi `DATABASE_URL` jeśli używasz `render.yaml`.

Jeśli wdrażasz ręcznie:
1. Utwórz PostgreSQL Database w Render
2. Dodaj zmienną:
   ```
   DATABASE_URL=<connection-string-z-render>
   ```
   **Uwaga:** Dodaj `?sslmode=require` na końcu jeśli Render nie dodał automatycznie.

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
   curl https://your-net-server.onrender.com/health
   ```
   Powinno zwrócić: `{"status":"ok"}`

3. **Test API:**
   ```bash
   curl https://your-net-server.onrender.com/api/auth/register \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123456"}'
   ```

---

## 🔗 Ustawienie VITE_API_URL w Vercel

Po udanym deploymencie net-server:

1. **Skopiuj URL Render:**
   - Przejdź do Render Dashboard → net-server
   - Skopiuj URL (np. `https://net-server-xyz.onrender.com`)

2. **Dodaj w Vercel:**
   - Vercel Dashboard → Twój projekt → Settings → Environment Variables
   - **Key:** `VITE_API_URL`
   - **Value:** `https://net-server-xyz.onrender.com`
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
- Sprawdź czy Render automatycznie dodał DATABASE_URL
- Upewnij się, że zawiera `?sslmode=require`

### Błąd: "CORS error" w przeglądarce
**Problem:** FRONTEND_URL nie zawiera dokładnego URL frontendu  
**Rozwiązanie:** 
- Zaktualizuj FRONTEND_URL w Render: `https://your-app.vercel.app`
- Zrób redeploy backendu

### Błąd: "Build failed"
**Problem:** Zależności nie mogą być zainstalowane  
**Rozwiązanie:**
- Sprawdź czy `pnpm-lock.yaml` jest w repo
- Sprawdź logi build w Render

---

## 📚 Dodatkowe Informacje

- **Health Check:** Render używa `/health` do monitorowania
- **Auto Deploy:** Włączone domyślnie (deploy przy każdym push do main)
- **Logs:** Dostępne w Render Dashboard → Logs
- **Metrics:** Render pokazuje użycie CPU, RAM, requesty

---

## 🔄 Aktualizacja FRONTEND_URL

Gdy zmienisz URL frontendu w Vercel:

1. Zaktualizuj `FRONTEND_URL` w Render Dashboard
2. Zrób "Manual Deploy" lub poczekaj na auto-deploy

**Uwaga:** Zmiany w env variables wymagają restart serwisu (Render robi to automatycznie).

