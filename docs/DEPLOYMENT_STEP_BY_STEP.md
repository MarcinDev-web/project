# 🚀 Kompletna Instrukcja Wdrożenia - Krok po Kroku

## 📋 Przegląd

Ten przewodnik przeprowadzi Cię przez wdrożenie na **Railway.app**:
1. Wdrożenie backendu (`net-server`) na Railway
2. Konfigurację zmiennych środowiskowych
3. Ustawienie `VITE_API_URL` w Vercel
4. Redeploy frontendu

---

## Krok 1: Wdrożenie Backendu na Railway

### 1.1. Utworzenie projektu

1. **Przejdź na Railway.app:**
   - Zaloguj się: https://railway.app
   - Kliknij **"New Project"** → **"Deploy from GitHub"**

2. **Wybierz repozytorium:**
   - Wybierz repozytorium z tym projektem
   - Railway automatycznie wykryje projekt

3. **Dodaj serwis:**
   - Railway może automatycznie wykryć `net-server` z monorepo
   - Jeśli nie, kliknij **"+ New"** → **"GitHub Repo"** → wybierz repo
   - W konfiguracji serwisu ustaw:
     - **Root Directory:** *(zostaw puste - monorepo root)*
     - Railway powinien automatycznie wykryć `package.json`

4. **Skonfiguruj Build & Start:**
   - Przejdź do **Settings** → **Build & Deploy**
   - **Build Command:** `pnpm i --frozen-lockfile && pnpm -w --filter @apps/net-server build`
   - **Start Command:** `node apps/net-server/dist/server.js`

### 1.2. Dodanie PostgreSQL Database

1. **W projekcie Railway kliknij "+ New":**
   - Wybierz **"Database"** → **"PostgreSQL"**
   - Railway automatycznie utworzy bazę i ustawi zmienną `DATABASE_URL`
   - **Uwaga:** Railway automatycznie dodaje `sslmode=require`

2. **Railway pokaże informacje o bazie:**
   - HTTP Domain: `net-server-db-production.up.railway.app` *(używane wewnętrznie przez Railway)*
   - TCP Proxy: `interchange.proxy.rlwy.net:17882` *(do ręcznego połączenia, opcjonalne)*
   - **Nie musisz używać tych endpointów ręcznie** - Railway automatycznie ustawi `DATABASE_URL` w serwisie `net-server`

3. **Sprawdź czy `DATABASE_URL` jest ustawione:**
   - Przejdź do serwisu `net-server` → **Variables**
   - Powinieneś zobaczyć `DATABASE_URL` ustawione automatycznie
   - Connection string będzie w formacie: `postgresql://...@.../?sslmode=require`

### 1.3. Generowanie JWT Secrets

Wygeneruj secrets przed wdrożeniem:

```bash
# W terminalu projektu:
node scripts/generate-jwt-secret.js
```

**Skopiuj wygenerowane wartości** - będą potrzebne w następnym kroku.

---

## Krok 2: Konfiguracja Zmiennych Środowiskowych

### 2.1. Otwórz konfigurację net-server

1. W Railway Dashboard → Twój projekt → `net-server`
2. Przejdź do **Variables** (lub **Settings** → **Variables**)

### 2.2. Dodaj wymagane zmienne

1. **`NODE_ENV`:**
   - **Value:** `production`

2. **`JWT_SECRET`:**
   - **Value:** *(wartość z kroku 1.3)*
   - Minimum 32 znaki

3. **`JWT_REFRESH_SECRET`:**
   - **Value:** *(wartość z kroku 1.3)*
   - Minimum 32 znaki

4. **`FRONTEND_URL`:**
   - **Value:** `https://your-app.vercel.app`
   - *(zastąp swoim URL frontendu)*

5. **`DATABASE_URL`:**
   - ✅ Railway automatycznie ustawi to przy dodaniu PostgreSQL Database
   - Jeśli nie widzisz tej zmiennej, upewnij się że baza została dodana do projektu

### 2.3. Zapisz zmiany

- Railway automatycznie zapisuje zmienne przy każdej edycji
- Railway automatycznie zrestartuje serwis po zmianie zmiennych środowiskowych

---

## Krok 3: Oczekiwanie na Deploy

### 3.1. Monitoruj logi

1. W Railway Dashboard → `net-server` → **Deployments** → kliknij najnowszy deployment → **View Logs**
   - Lub przejdź bezpośrednio do **Logs** w bocznym menu serwisu
2. Szukaj komunikatu:
   ```
   ✅ Configuration validation passed
   ```
3. Jeśli widzisz błędy, sprawdź zmienne środowiskowe

### 3.2. Uzyskaj publiczny URL

1. **W Railway Dashboard → `net-server`:**
   - Przejdź do **Settings** → **Networking**
   - Kliknij **"Generate Domain"** (jeśli jeszcze nie masz)
   - Railway wygeneruje URL w formacie: `https://net-server-production.up.railway.app`
   - **Skopiuj ten URL** - będzie potrzebny w następnym kroku

### 3.3. Test endpointu

1. **Test health check:**
   ```bash
   curl https://net-server-production.up.railway.app/health
   ```
   Powinno zwrócić: `{"status":"ok"}`

---

## Krok 4: Ustawienie VITE_API_URL w Vercel

### 4.1. Przez Vercel Dashboard (Zalecane)

1. **Otwórz Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Wybierz projekt `nowy-folder-4`

2. **Przejdź do Environment Variables:**
   - Settings → **Environment Variables**

3. **Dodaj nową zmienną:**
   - **Key:** `VITE_API_URL`
   - **Value:** `https://net-server-production.up.railway.app` *(URL z kroku 3.2)*
   - **Environments:** ✅ Production, ✅ Preview (opcjonalnie)

4. **Zapisz**

### 4.2. Przez Vercel CLI (Alternatywa)

```bash
# W katalogu projektu:
vercel env add VITE_API_URL production

# Wprowadź wartość gdy zostaniesz zapytany:
# https://net-server-production.up.railway.app

# Powtórz dla preview (opcjonalnie):
vercel env add VITE_API_URL preview
```

---

## Krok 5: Redeploy Frontendu

### 5.1. Przez Vercel Dashboard

1. Przejdź do **Deployments**
2. Kliknij **"..."** na najnowszym deployment
3. Wybierz **"Redeploy"**
4. Potwierdź

### 5.2. Przez Vercel CLI

```bash
vercel --prod
```

---

## Krok 6: Weryfikacja

### 6.1. Test Frontendu

1. Otwórz https://nowy-folder-4.vercel.app/register
2. Spróbuj zarejestrować użytkownika
3. **Nie powinno być błędu 405!**

### 6.2. Sprawdź Network Tab

1. Otwórz DevTools → Network
2. Spróbuj zarejestrować użytkownika
3. Request do `/api/auth/register` powinien:
   - ✅ Mieć status 201 (Created) lub 400 (Validation Error)
   - ❌ NIE powinien mieć 405 (Method Not Allowed)

---

## ✅ Checklist Podsumowujący

- [ ] Backend wdrożony na Railway (`net-server`)
- [ ] PostgreSQL Database dodana do projektu Railway
- [ ] `JWT_SECRET` i `JWT_REFRESH_SECRET` ustawione w Railway Variables
- [ ] `FRONTEND_URL` ustawione na URL Vercel w Railway
- [ ] `DATABASE_URL` automatycznie ustawione przez Railway
- [ ] Publiczny domain wygenerowany w Railway (Settings → Networking)
- [ ] Health check zwraca `{"status":"ok"}`
- [ ] `VITE_API_URL` ustawione w Vercel (Production)
- [ ] Frontend zrobiony redeploy
- [ ] Test rejestracji działa (brak 405)

---

## 🐛 Troubleshooting

### Problem: "405 Method Not Allowed" nadal występuje

**Sprawdź:**
1. Czy `VITE_API_URL` jest ustawione w Vercel?
2. Czy frontend był zrobiony redeploy PO dodaniu env variable?
3. Czy backend URL jest prawidłowy (testuj curl)

**Rozwiązanie:**
```bash
# Sprawdź czy env variable jest ustawione:
vercel env ls production

# Jeśli nie ma, dodaj:
vercel env add VITE_API_URL production

# Zrób redeploy:
vercel --prod
```

### Problem: Backend nie startuje - "Configuration validation failed"

**Sprawdź logi w Railway Dashboard** (Deployments → View Logs) - pokażą dokładny błąd.

**Najczęstsze problemy:**
- `JWT_SECRET` za krótkie (< 32 znaki)
- `FRONTEND_URL` nie ustawione
- `DATABASE_URL` nieprawidłowy

### Problem: CORS errors w przeglądarce

**Sprawdź:**
1. Czy `FRONTEND_URL` w platformie zawiera dokładny URL frontendu (z `https://`)
2. Czy frontend URL jest bez trailing slash

**Rozwiązanie:**
- Zaktualizuj `FRONTEND_URL` w Railway Variables
- Railway automatycznie zrestartuje serwis po zmianie

---

## 📚 Dodatkowe Dokumenty

- `docs/ENV_VARIABLES.md` - Pełna lista zmiennych środowiskowych
- `docs/DEPLOY_NET_SERVER.md` - Szczegóły deploy backendu

---

## 🎉 Gotowe!

Po wykonaniu wszystkich kroków:
- ✅ Frontend będzie komunikował się z backendem
- ✅ Rejestracja/login będą działać
- ✅ Wszystkie API endpoints będą dostępne

**Następne kroki:**
- Skonfiguruj custom domain (opcjonalnie)
- Włącz monitoring i alerty
- Skonfiguruj backups dla PostgreSQL

