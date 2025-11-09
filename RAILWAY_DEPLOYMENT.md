# Railway Deployment Guide

## Przetestowane lokalnie

✅ **net-server** - build zakończony sukcesem
- Obraz: `net-server-test`
- Rozmiar: ~587MB

## Zmiany w Dockerfiles

### apps/net-server/Dockerfile
- ✅ Kopiowanie z builder stage zamiast lokalnego systemu plików
- ✅ Poprawne ścieżki dla Prisma client
- ✅ Dodano kopiowanie `shared` i `scripts`
- ✅ Build core i world przed aplikacją
- ✅ Wykluczenie niepotrzebnych pakietów z buildu

### apps/collab-server/Dockerfile
- ✅ Te same poprawki co w net-server

## Zmiany w konfiguracjach TypeScript

### Naprawione pakiety:
1. **core** - dodano `rootDir: "./src"` dla poprawnej struktury outputu
2. **world** - dodano `rootDir: "./src"` dla poprawnej struktury outputu
3. **test-utils** - usunięto project references, użyto path mappings
4. **economy** - dodano path mappings dla `@engine/core`
5. **gateway** - dodano path mappings dla `@shared/*`
6. **camera** - zmieniono na `composite: false`, dodano path mappings
7. **net-server** - zmieniono `moduleResolution` na `bundler`, poprawiono path mappings
8. **input** - usunięto referencję do `camera`

### Wyłączone buildy w produkcji:
- `test-utils` - tylko do testów
- `script` - nie używany w serwerach
- `gateway` - osobny serwis
- `camera` - nie używany w serwerach
- `editor-utils` - tylko do edytora
- `voxel` - nie używany w serwerach
- `world-templates` - nie używany w serwerach
- `net` - nie używany w serwerach
- `avatar` - nie używany w serwerach
- `microblocks` - nie używany w serwerach

## Deploy na Railway

### 1. Przygotowanie repozytorium

Upewnij się, że wszystkie zmiany są commitowane:
```bash
git add .
git commit -m "Fix Docker builds for Railway deployment"
git push
```

### 2. Konfiguracja Railway

#### Dla net-server:

1. **Utwórz nowy projekt w Railway**
2. **Połącz repozytorium GitHub**
3. **Dodaj serwis:**
   - **Root Directory:** `/` (root repo)
   - **Dockerfile Path:** `apps/net-server/Dockerfile`
   - **Service Name:** `net-server`

4. **Ustaw zmienne środowiskowe:**
   ```
   NODE_ENV=production
   PORT=3000
   WS_PORT=3001
   DATABASE_URL=<postgresql-connection-string>
   JWT_SECRET=<your-jwt-secret>
   CORS_ORIGIN=<allowed-origins>
   ```

5. **Dodaj PostgreSQL:**
   - Railway automatycznie utworzy bazę danych
   - `DATABASE_URL` zostanie automatycznie ustawione

6. **Porty:**
   - Railway automatycznie wykryje porty z `EXPOSE`
   - Upewnij się, że porty 3000 i 3001 są dostępne

#### Dla collab-server:

1. **Dodaj drugi serwis w tym samym projekcie:**
   - **Root Directory:** `/` (root repo)
   - **Dockerfile Path:** `apps/collab-server/Dockerfile`
   - **Service Name:** `collab-server`

2. **Ustaw zmienne środowiskowe:**
   ```
   NODE_ENV=production
   PORT=4000
   DATABASE_URL=<postgresql-connection-string>
   JWT_SECRET=<your-jwt-secret>
   CORS_ORIGIN=<allowed-origins>
   ```

### 3. Migracje bazy danych

Po pierwszym deployu, uruchom migracje:

```bash
# Dla net-server
railway run --service net-server pnpm -C apps/net-server db:migrate

# Dla collab-server
railway run --service collab-server pnpm -C apps/collab-server db:migrate
```

### 4. Weryfikacja deployu

Sprawdź health check endpoints:
- `https://your-net-server.railway.app/health`
- `https://your-collab-server.railway.app/health`

## Troubleshooting

### Problem: Build fails z błędami TypeScript
- **Rozwiązanie:** Upewnij się, że wszystkie zmiany w tsconfig.json są commitowane

### Problem: Prisma client not found
- **Rozwiązanie:** Sprawdź, czy Prisma client jest kopiowany z builder stage

### Problem: Module not found errors
- **Rozwiązanie:** Sprawdź path mappings w tsconfig.json aplikacji

### Problem: Port conflicts
- **Rozwiązanie:** Railway automatycznie przypisze porty, sprawdź zmienne środowiskowe

## Notatki

- Buildy mogą trwać ~5-10 minut ze względu na rozmiar monorepo
- Obrazy Docker są ~500-600MB po kompresji
- Wszystkie niepotrzebne pakiety są wyłączone z buildu dla szybszego deployu
- Health checks są skonfigurowane automatycznie w Dockerfiles

