# 🚀 Jak uruchomić pełną platformę PLAYVERSE

**Platforma składa się z 3 głównych części:**
1. **Backend API** (net-server) - port 3000
2. **Frontend Platform** (platform) - port 5174
3. **3D Editor** (editor) - port 5173

## Krok 1: Upewnij się, że Docker PostgreSQL działa

```powershell
# Sprawdź czy działa
docker ps

# Jeśli nie działa, uruchom:
docker-compose up -d db
```

## Krok 2: Uruchom Backend (API Server)

W **pierwszym terminalu**:

```powershell
# Z root projektu
pnpm dev:server

# LUB bezpośrednio:
cd apps/net-server
pnpm dev
```

**Serwer będzie dostępny na:** `http://localhost:3000`

✅ Powinieneś zobaczyć:
```
Net server listening on http://localhost:3000
Data directory: ./data
Auth manager initialized
✅ Configuration validation passed
```

## Krok 3: Uruchom Frontend Platform

W **drugim terminalu** (nowe okno):

```powershell
# Z root projektu
pnpm dev:platform

# LUB bezpośrednio:
cd apps/platform
pnpm dev
```

**Platform będzie dostępna na:** `http://localhost:5174`

## Krok 4: Uruchom 3D Editor (opcjonalnie)

W **trzecim terminalu** (nowe okno):

```powershell
# Z root projektu
pnpm dev:editor

# LUB bezpośrednio:
cd apps/editor
pnpm dev
```

**Editor będzie dostępny na:** `http://localhost:5173`

## Krok 5: Sprawdź czy wszystko działa

1. **Backend Health Check:**
   ```powershell
   Invoke-WebRequest -Uri http://localhost:3000/health
   ```
   Powinno zwrócić: `{"status":"ok"}`

2. **Frontend Platform:**
   Otwórz w przeglądarce: `http://localhost:5174`

3. **3D Editor (jeśli uruchomiony):**
   Otwórz w przeglądarce: `http://localhost:5173`

## 📋 Pełna sekwencja (wszystko w jednym)

### PowerShell - nowe okno terminala dla każdego serwisu:

**Terminal 1 - Backend:**
```powershell
cd "C:\Users\malgo\Documents\Nowy folder (4)"
pnpm dev:server
```

**Terminal 2 - Frontend Platform:**
```powershell
cd "C:\Users\malgo\Documents\Nowy folder (4)"
pnpm dev:platform
```

**Terminal 3 - 3D Editor (opcjonalnie):**
```powershell
cd "C:\Users\malgo\Documents\Nowy folder (4)"
pnpm dev:editor
```

## 🔧 Porty

- **Backend API:** `http://localhost:3000`
- **Frontend Platform:** `http://localhost:5174` (zobacz apps/platform/vite.config.ts)
- **3D Editor:** `http://localhost:5173` (Vite default dla editor)
- **WebSocket:** `ws://localhost:3001` (automatycznie z backend)

## ✅ Test logowania admina

1. Otwórz platform: `http://localhost:5174`
2. Kliknij "Login"
3. Zaloguj się:
   - **Email:** `admin@forge.pl`
   - **Hasło:** `Admin123!`

## 🐛 Rozwiązywanie problemów

### Backend nie startuje:
- Sprawdź czy Docker PostgreSQL działa: `docker ps`
- Sprawdź czy port 3000 jest wolny: `Get-NetTCPConnection -LocalPort 3000`
- Sprawdź logi w terminalu backend

### Frontend nie łączy się z backendem:
- Sprawdź czy backend działa na `http://localhost:3000`
- Sprawdź `apps/platform/src/api/client.ts` - powinien wskazywać na `/api`
- Sprawdź console w przeglądarce (F12) dla błędów CORS

### Błąd CORS:
- Upewnij się, że backend ma ustawione `FRONTEND_URL=http://localhost:5174` (lub zawiera w liście)
- Backend automatycznie używa tego w konfiguracji CORS
- Sprawdź czy vite proxy działa - wszystkie `/api/*` requesty są przekierowane na `http://localhost:3000`

## 📝 Quick Reference

```powershell
# Terminal 1 - Backend
pnpm dev:server

# Terminal 2 - Frontend Platform
pnpm dev:platform

# Terminal 3 - 3D Editor (opcjonalnie)
pnpm dev:editor

# Sprawdź Docker
docker ps

# Sprawdź porty
Test-NetConnection localhost -Port 3000  # Backend
Test-NetConnection localhost -Port 5174  # Platform
Test-NetConnection localhost -Port 5173  # Editor
```

## 🎯 Minimalne uruchomienie (tylko Platform)

Jeśli potrzebujesz tylko platform (bez edytora):

```powershell
# Terminal 1 - Backend
pnpm dev:server

# Terminal 2 - Platform
pnpm dev:platform
```

## 🎨 Pełne uruchomienie (Platform + Editor)

Jeśli chcesz mieć dostęp do edytora 3D:

```powershell
# Terminal 1 - Backend
pnpm dev:server

# Terminal 2 - Platform
pnpm dev:platform

# Terminal 3 - Editor
pnpm dev:editor
```

