# Development Orchestration Script

Jedna komenda PowerShell, która wykonuje pełny cykl developmentu: instalację, build, uruchomienie serwerów dev, health checki, testy i commit.

## Użycie

### Podstawowe użycie

```powershell
pnpm run dev:all
```

Lub bezpośrednio:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev-orchestration.ps1
```

### Z parametrami

```powershell
# Z własnym komunikatem commita
pnpm run dev:all -- -CommitMessage "feat: add new feature"

# Z niestandardowymi adresami serwerów
pnpm run dev:all -- -NetServerUrl "http://localhost:3000" -CollabServerUrl "http://localhost:4000"

# Z niestandardowym hostem/portem bazy danych
pnpm run dev:all -- -DbHost "localhost" -DbPort 5432

# Bez commita (tylko testy i build)
pnpm run dev:all -- -SkipCommit
```

## Co robi skrypt?

Skrypt wykonuje następujące kroki **sekwencyjnie**:

1. **`pnpm install`** - Instalacja wszystkich zależności
2. **`pnpm build:all`** - Build wszystkich pakietów
3. **Uruchomienie serwerów dev** (w tle z port readiness checks):
   - `pnpm run dev:server` - Net Server (port 3000)
   - `pnpm run dev:platform` - Platform (port 5174)
   - `pnpm run dev:editor` - Editor (port 5173)
   - Każdy serwer jest uruchamiany i skrypt **czeka aż port będzie gotowy** przed przejściem dalej
4. **Health checki** (z exponential backoff retry):
   - Sprawdzenie połączenia z bazą danych (PostgreSQL na localhost:5432) - 5 prób z exponential backoff
   - Sprawdzenie Net Server (`http://localhost:3000/health`) - 5 prób z exponential backoff
   - Sprawdzenie Collab Server (`http://localhost:4000/health`) - 5 prób z exponential backoff
5. **`pnpm test`** - Uruchomienie wszystkich testów
6. **Git commit** - Commit wszystkich zmian z domyślnym komunikatem

### Ulepszenia stabilności

- **Port-based readiness**: Skrypt sprawdza czy porty są otwarte zamiast używać stałych opóźnień
- **Exponential backoff**: Health checki używają exponential backoff (1s → 2s → 4s → 8s) zamiast stałych opóźnień
- **Per-service configuration**: Każdy serwis ma własne timeouty i ustawienia
- **Lepsze diagnostyki**: Szczegółowe komunikaty błędów z wskazówkami troubleshooting

## Parametry

| Parametr | Typ | Domyślna wartość | Opis |
|----------|-----|------------------|------|
| `-CommitMessage` | string | `"chore: development changes"` | Komunikat commita |
| `-DbHost` | string | `"localhost"` | Host bazy danych |
| `-DbPort` | int | `5432` | Port bazy danych |
| `-NetServerUrl` | string | `"http://localhost:3000"` | URL Net Server |
| `-CollabServerUrl` | string | `"http://localhost:4000"` | URL Collab Server |
| `-SkipCommit` | switch | `$false` | Pomiń commit (tylko build/testy) |

## Przykłady użycia

### Podstawowy workflow

```powershell
# Pełny cykl: install → build → dev servers → health checks → testy → commit
pnpm run dev:all
```

### Tylko build i testy (bez commita)

```powershell
pnpm run dev:all -- -SkipCommit
```

### Z własnym komunikatem commita

```powershell
pnpm run dev:all -- -CommitMessage "feat: implement new authentication system"
```

### Z niestandardowymi portami serwerów

```powershell
pnpm run dev:all -- -NetServerUrl "http://localhost:3001" -CollabServerUrl "http://localhost:4001"
```

### Z niestandardową bazą danych

```powershell
pnpm run dev:all -- -DbHost "192.168.1.100" -DbPort 5433
```

## Wymagania

- **PowerShell 5.1+** (Windows PowerShell) lub **PowerShell 7+** (PowerShell Core)
- **pnpm** zainstalowany i dostępny w PATH
- **Git** zainstalowany i dostępny w PATH
- **Node.js** >= 22.0.0 (zgodnie z `package.json`)
- **PostgreSQL** uruchomiony (dla health checku bazy danych)

## Zachowanie

### Serwery dev

- Serwery są uruchamiane **w tle** (background processes)
- **Port readiness checks**: Skrypt sprawdza czy port jest otwarty zamiast używać stałych opóźnień
  - Net Server: maksymalnie 30 sekund na otwarcie portu 3000
  - Platform: maksymalnie 45 sekund na otwarcie portu 5174
  - Editor: maksymalnie 45 sekund na otwarcie portu 5173
- Skrypt **czeka aż każdy port będzie gotowy** przed uruchomieniem następnego serwera
- Serwery pozostają uruchomione do momentu przerwania skryptu (Ctrl+C)
- Po przerwaniu wszystkie procesy są automatycznie zatrzymywane

### Health checki

- **Database**: Używa `Test-NetConnection` do sprawdzenia połączenia TCP
  - **5 prób** z exponential backoff (2s → 4s → 8s → 10s → 10s)
  - Szczegółowe komunikaty błędów z wskazówkami troubleshooting
- **Net Server**: HTTP GET do `/health` endpoint
  - **5 prób** z exponential backoff (1s → 2s → 4s → 8s → 8s)
  - Rozróżnia timeouty od błędów HTTP
- **Collab Server**: HTTP GET do `/health` endpoint
  - **5 prób** z exponential backoff (1s → 2s → 4s → 8s → 8s)
  - Rozróżnia timeouty od błędów HTTP

Jeśli health check się nie powiedzie, skrypt **kontynuuje** wykonanie (nie przerywa), ale wyświetla ostrzeżenie z diagnostyką.

### Testy

- Uruchamiane są **wszystkie testy** (`pnpm test`)
- Jeśli testy się nie powiodą, skrypt przerywa wykonanie
- Commit **nie jest wykonywany** jeśli testy się nie powiodły

### Commit

- Automatycznie **stage'uje wszystkie zmiany** (`git add -A`)
- Używa podanego komunikatu commita (lub domyślnego)
- Jeśli nie ma zmian do commita, pomija ten krok
- Można pominąć commit używając flagi `-SkipCommit`

## Obsługa błędów

Skrypt używa `$ErrorActionPreference = "Stop"`, więc:

- **Każdy błąd przerywa wykonanie** skryptu
- **Wszystkie procesy dev są zatrzymywane** w bloku `finally`
- **Wyświetlany jest komunikat błędu** z stack trace

## Przerwanie skryptu

Aby zatrzymać skrypt i wszystkie serwery dev:

1. Naciśnij **Ctrl+C**
2. Skrypt automatycznie zatrzyma wszystkie procesy dev
3. Wyświetli podsumowanie i zakończy działanie

## Output

Skrypt wyświetla kolorowe komunikaty:

- **Cyan** - Nagłówki sekcji
- **Green** - Sukcesy
- **Red** - Błędy
- **Yellow** - Informacje

## Troubleshooting

### Problem: "pnpm command failed"

**Rozwiązanie**: Sprawdź czy pnpm jest zainstalowany i dostępny w PATH:
```powershell
pnpm --version
```

### Problem: "Database connection failed"

**Rozwiązanie**: 
- Sprawdź czy PostgreSQL jest uruchomiony: `docker-compose up db`
- Sprawdź czy port 5432 jest dostępny: `Test-NetConnection -ComputerName localhost -Port 5432`
- Sprawdź zmienną środowiskową `DATABASE_URL`
- Skrypt automatycznie ponawia próby z exponential backoff (5 prób)
- Użyj `-DbHost` i `-DbPort` jeśli używasz niestandardowej konfiguracji

### Problem: "Net Server health check failed"

**Rozwiązanie**:
- Sprawdź czy Net Server się uruchomił (sprawdź logi procesu)
- Sprawdź czy endpoint `/health` istnieje: `curl http://localhost:3000/health`
- Sprawdź czy port 3000 jest otwarty: `Test-NetConnection -ComputerName localhost -Port 3000`
- Skrypt automatycznie ponawia próby z exponential backoff (5 prób)
- Jeśli serwer startuje wolno, zwiększ `MaxStartupWaitSeconds` w konfiguracji skryptu
- Użyj `-NetServerUrl` jeśli serwer działa na innym porcie

### Problem: "Collab Server health check failed"

**Rozwiązanie**:
- Sprawdź czy Collab Server się uruchomił (sprawdź logi procesu)
- Sprawdź czy endpoint `/health` istnieje: `curl http://localhost:4000/health`
- Sprawdź czy port 4000 jest otwarty: `Test-NetConnection -ComputerName localhost -Port 4000`
- Skrypt automatycznie ponawia próby z exponential backoff (5 prób)
- Jeśli serwer startuje wolno, zwiększ `MaxStartupWaitSeconds` w konfiguracji skryptu
- Użyj `-CollabServerUrl` jeśli serwer działa na innym porcie

### Problem: "Server port did not become ready within X seconds"

**Rozwiązanie**:
- **Wolny start**: Jeśli masz wolny komputer, serwery mogą potrzebować więcej czasu
  - Edytuj `scripts/dev-orchestration.ps1` i zwiększ `MaxStartupWaitSeconds` dla odpowiedniego serwisu
  - Domyślne wartości: Net Server (30s), Platform (45s), Editor (45s)
- **Port zajęty**: Sprawdź czy port nie jest już używany przez inny proces
  ```powershell
  Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
  ```
- **Błąd uruchomienia**: Sprawdź logi procesu - może być błąd kompilacji lub konfiguracji
- **Firewall**: Sprawdź czy firewall nie blokuje portów

### Problem: "ExecutionPolicy restriction"

**Rozwiązanie**: Uruchom PowerShell jako Administrator i wykonaj:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Lub użyj flagi `-ExecutionPolicy Bypass` (już zawarta w skrypcie package.json).

## Integracja z CI/CD

Skrypt może być używany lokalnie przed push'em:

```powershell
# Przed push'em: build, testy, commit
pnpm run dev:all -- -CommitMessage "feat: new feature"
git push
```

## Notatki

- Skrypt **nie uruchamia** bazy danych - musi być już uruchomiona
- Skrypt **nie uruchamia** Docker - zakłada lokalne środowisko
- Health checki są **opcjonalne** - skrypt kontynuuje nawet jeśli się nie powiodą
- Testy są **wymagane** - skrypt przerywa jeśli testy się nie powiodą

