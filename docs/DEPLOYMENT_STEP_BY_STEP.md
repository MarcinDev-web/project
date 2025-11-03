# 🚀 Kompletna Instrukcja Wdrożenia - Krok po Kroku

## 📋 Przegląd

Ten przewodnik przeprowadzi Cię przez:
1. Wdrożenie backendu (`net-server`) na Render.com
2. Konfigurację zmiennych środowiskowych
3. Ustawienie `VITE_API_URL` w Vercel
4. Redeploy frontendu

---

## Krok 1: Wdrożenie Backendu na Render.com

### 1.1. Przygotowanie repozytorium

✅ **Już zrobione:** `render.yaml` został zaktualizowany z konfiguracją `net-server`

### 1.2. Wdrożenie przez Render Blueprint

1. **Przejdź na Render.com:**
   - Zaloguj się: https://dashboard.render.com
   - Kliknij **"New"** → **"Blueprint"**

2. **Połącz z GitHub:**
   - Wybierz repozytorium z tym projektem
   - Render automatycznie wykryje `render.yaml`

3. **Przejrzyj konfigurację:**
   - Render pokaże wszystkie serwisy z `render.yaml`
   - Powinieneś zobaczyć:
     - ✅ `collab-server` (już istniejący)
     - ✅ `net-server` (nowy)
     - ✅ `net-server-db` (PostgreSQL database)

4. **Potwierdź wdrożenie:**
   - Kliknij **"Apply"** lub **"Create"**
   - Render zacznie budować i wdrażać serwisy

### 1.3. Generowanie JWT Secrets

Podczas gdy Render buduje, wygeneruj secrets:

```bash
# W terminalu projektu:
node scripts/generate-jwt-secret.js
```

**Skopiuj wygenerowane wartości** - będą potrzebne w następnym kroku.

---

## Krok 2: Konfiguracja Zmiennych Środowiskowych w Render

### 2.1. Otwórz konfigurację net-server

1. W Render Dashboard → Services → `net-server`
2. Przejdź do **Settings** → **Environment**

### 2.2. Zaktualizuj zmienne

**Ważne:** `render.yaml` automatycznie utworzy większość zmiennych, ale musisz zaktualizować `FRONTEND_URL`.

1. **Znajdź `FRONTEND_URL`:**
   - Kliknij na wartość
   - Zaktualizuj na: `https://nowy-folder-4.vercel.app`
   - *(lub twój custom domain jeśli masz)*

2. **Sprawdź czy `JWT_SECRET` i `JWT_REFRESH_SECRET` są ustawione:**
   - Render powinien automatycznie wygenerować wartości
   - Jeśli nie ma, dodaj ręcznie używając wartości z kroku 1.3

3. **Sprawdź `DATABASE_URL`:**
   - Powinno być automatycznie ustawione przez Render
   - Format: `postgresql://...?sslmode=require`

### 2.3. Zapisz i zrestartuj

- Kliknij **"Save Changes"**
- Render automatycznie zrestartuje serwis

---

## Krok 3: Oczekiwanie na Deploy

### 3.1. Monitoruj logi

1. W Render Dashboard → `net-server` → **Logs**
2. Szukaj komunikatu:
   ```
   ✅ Configuration validation passed
   ```
3. Jeśli widzisz błędy, sprawdź zmienne środowiskowe

### 3.2. Test endpointu

Gdy deploy się zakończy:

1. **Skopiuj URL serwisu:**
   - W Render Dashboard → `net-server`
   - Skopiuj URL (np. `https://net-server-xyz.onrender.com`)

2. **Test health check:**
   ```bash
   curl https://net-server-xyz.onrender.com/health
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
   - **Value:** `https://net-server-xyz.onrender.com` *(URL z kroku 3.2)*
   - **Environments:** ✅ Production, ✅ Preview (opcjonalnie)

4. **Zapisz**

### 4.2. Przez Vercel CLI (Alternatywa)

```bash
# W katalogu projektu:
vercel env add VITE_API_URL production

# Wprowadź wartość gdy zostaniesz zapytany:
# https://net-server-xyz.onrender.com

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

- [ ] Backend wdrożony na Render (`net-server`)
- [ ] `JWT_SECRET` i `JWT_REFRESH_SECRET` ustawione w Render
- [ ] `FRONTEND_URL` zaktualizowane w Render na URL Vercel
- [ ] `DATABASE_URL` automatycznie ustawione przez Render
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

**Sprawdź logi Render** - pokażą dokładny błąd.

**Najczęstsze problemy:**
- `JWT_SECRET` za krótkie (< 32 znaki)
- `FRONTEND_URL` nie ustawione
- `DATABASE_URL` nieprawidłowy

### Problem: CORS errors w przeglądarce

**Sprawdź:**
1. Czy `FRONTEND_URL` w Render zawiera dokładny URL frontendu (z `https://`)
2. Czy frontend URL jest bez trailing slash

**Rozwiązanie:**
- Zaktualizuj `FRONTEND_URL` w Render
- Zrób restart serwisu

---

## 📚 Dodatkowe Dokumenty

- `docs/ENV_VARIABLES.md` - Pełna lista zmiennych środowiskowych
- `docs/DEPLOY_NET_SERVER.md` - Szczegóły deploy backendu
- `render.yaml` - Konfiguracja Render

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

