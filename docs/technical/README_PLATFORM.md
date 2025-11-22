# Forge World Platform - Uruchomienie

## Struktura Projektu

Projekt składa się z trzech głównych aplikacji:

1. **Backend (net-server)** - Port 3000
   - API REST dla autoryzacji, marketplace, profiles, friends, messages
   - WebSocket server (port 3001) dla real-time collaboration

2. **Platform Frontend** - Port 5174
   - Aplikacja React z marketplace, profiles, messages
   - Entry point dla użytkowników

3. **Editor** - Port 5173
   - Profesjonalny edytor scen 3D
   - WebGPU renderer

## Pierwsze uruchomienie

### 1. Zainstaluj zależności

```bash
pnpm install
```

### 2. Uruchom wszystkie serwisy

**Opcja A: Osobne terminale (Zalecane dla development)**

Otwórz 3 osobne terminale:

**Terminal 1 - Backend:**
```bash
pnpm dev:server
```

**Terminal 2 - Platform:**
```bash
pnpm dev:platform
```

**Terminal 3 - Editor:**
```bash
pnpm dev:editor
```

**Opcja B: Uruchom jeden na raz (jeśli masz tylko jeden terminal)**

```bash
# Terminal 1
pnpm dev:server

# Po uruchomieniu, w nowym terminalu:
pnpm dev:platform

# Po uruchomieniu, w kolejnym terminalu:
pnpm dev:editor
```

**Opcja C: Docker (collab-server + Postgres)**

```bash
docker compose up --build
```

- collab-server (Fastify+WS): http://localhost:4000/health
- DB: postgres://collab:collab@localhost:5432/collab (wewnątrz compose: host `db`)

## Dostęp do aplikacji

Po uruchomieniu wszystkich serwisów:

- **Platform**: http://localhost:5174
- **Editor**: http://localhost:5173
- **Backend API**: http://localhost:3000/health (legacy)
- **Collab Server**: http://localhost:4000/health

## Przepływ użytkownika

1. Użytkownik wchodzi na **Platform** (5174)
2. Rejestruje/loguje się
3. Z dashboard może:
   - Przejść do **Editor** (5173) przez przycisk "Launch Editor"
   - Przeglądać **Marketplace**
   - Zarządzać **Profilem**
   - Sprawdzać **Messages**

## Rozwiązywanie problemów

### Port już zajęty?

Jeśli port jest zajęty, możesz zmienić:
- Platform: Edytuj `apps/platform/vite.config.ts` → `server.port`
- Editor: Edytuj `apps/editor/vite.config.ts` → `server.port`
- Backend: Ustaw zmienną środowiskową `PORT=3001` (lub inna)

### Błąd "Cannot find module"

Uruchom ponownie:
```bash
pnpm install
```

### Backend nie odpowiada

Sprawdź czy:
- Port 3000 nie jest zajęty przez inną aplikację
- Backend się uruchomił (sprawdź output w terminalu)
- Test: http://localhost:3000/health powinien zwrócić `{"status":"ok"}`

## Struktura komend

```bash
# Backend
pnpm dev:server          # Uruchom backend API

# Frontend
pnpm dev:platform        # Uruchom platform frontend
pnpm dev:editor          # Uruchom editor

# Build
pnpm build:platform      # Zbuduj platform
pnpm build:editor        # Zbuduj editor

# Inne
pnpm test                # Uruchom testy
pnpm lint                # Sprawdź linting
```

## Notatki

- Platform i Editor to osobne aplikacje Vite
- Backend używa TypeScript z tsx watch mode
- Wszystkie aplikacje komunikują się przez API na porcie 3000
- Platform przekierowuje do Editor na `/editor` route

