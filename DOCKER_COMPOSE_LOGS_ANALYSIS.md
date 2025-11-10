# Analiza logów docker-compose

## Podsumowanie

Build i uruchomienie kontenerów zakończyły się sukcesem, ale wystąpił **krytyczny problem z seeding marketplace** - wszystkie próby zapisania build data kończą się błędem foreign key constraint.

## Status kontenerów

### ✅ Build
- **collab-server**: Zbudowany pomyślnie (104.7s)
- **net-server**: Zbudowany pomyślnie (104.7s)
- Wszystkie zależności zainstalowane poprawnie

### ✅ Uruchomienie
- **db**: PostgreSQL 17.6 uruchomiony, gotowy do akceptacji połączeń
- **collab-server**: Nasłuchuje na http://127.0.0.1:4000 i http://172.18.0.3:4000
- **net-server**: Nasłuchuje na http://localhost:3000 i WebSocket na ws://localhost:3001
- Health checks przechodzą poprawnie

## 🔴 Problem: Foreign Key Constraint Violation

### Symptomy
```
ERROR: insert or update on table "marketplace_builds" violates foreign key constraint "marketplace_builds_marketplace_id_fkey"
DETAIL: Key (marketplace_id)=(item_1762810742752_kwy9l) is not present in table "marketplace_items".
```

### Analiza przyczyny

**Problem architektoniczny:**

1. **seedMarketplace.ts używa dwóch różnych storage:**
   - `MarketplaceStorage` (file-based) - zapisuje do `marketplace.json`
   - `BuildStorage` (database-based) - zapisuje do PostgreSQL

2. **Sekwencja operacji:**
   ```typescript
   // Linia 280: Tworzy item w FILE storage
   const item = await storage.createItem(mockItem);
   
   // Linia 310: Aktualizuje item w FILE storage
   await storage.updateItem(item.id, {...});
   
   // Linia 375: Próbuje zapisać build w DATABASE
   await buildStorage.saveBuild(item.id, projectData);
   ```

3. **Foreign key constraint wymaga:**
   - `marketplace_builds.marketplace_id` → `marketplace_items.id`
   - Ale `marketplace_items` jest puste w bazie danych!
   - Items istnieją tylko w pliku JSON

### Szczegóły błędów

**Wszystkie build items (12 sztuk) mają ten sam problem:**
- Medieval Castle
- Skyscraper Tower
- Victorian Mansion
- Shopping Mall
- Apartment Complex
- Futuristic Office
- Log Cabin
- Warehouse
- Town Square
- Japanese Temple
- Hospital
- (i inne)

**Avatar items (10 sztuk) działają poprawnie** - nie próbują zapisywać do `marketplace_builds`

### Impact

- ✅ Marketplace seeding częściowo działa (items są tworzone w file storage)
- ❌ Build data nie jest zapisywana (wszystkie próby failują)
- ⚠️ Aplikacja działa, ale marketplace builds są niekompletne
- ⚠️ API endpoints dla builds mogą zwracać puste dane

## 🔍 Root Cause

**Niezgodność storage backends:**

1. **seedMarketplace.ts** używa `MarketplaceStorage` (file-based)
2. **server.ts** prawdopodobnie używa `MarketplaceStorageDB` (database-based) w produkcji
3. **BuildStorage** zawsze używa database
4. Brak synchronizacji między file storage a database

## 💡 Rozwiązania

### Opcja 1: Użyj MarketplaceStorageDB w seedMarketplace (Rekomendowane)

Zmienić `seedMarketplace.ts` aby używał database storage zamiast file storage:

```typescript
// Zamiast:
const storage = new MarketplaceStorage(DATA_DIR);

// Użyć:
const dbPool = await createDbPool();
const storage = new MarketplaceStorageDB(dbPool);
```

**Zalety:**
- Spójność z produkcją
- Foreign key constraints będą działać
- Wszystkie dane w jednym miejscu (database)

**Wady:**
- Wymaga DATABASE_URL w środowisku seedowania

### Opcja 2: Migracja danych z file do database przed seeding builds

Dodać migrację przed zapisaniem build data:

```typescript
// Po utworzeniu item w file storage:
const item = await storage.createItem(mockItem);

// Migruj do database przed zapisaniem build:
await migrateItemToDatabase(item);

// Teraz można zapisać build:
await buildStorage.saveBuild(item.id, projectData);
```

**Zalety:**
- Zachowuje obecną architekturę
- Może być użyteczne dla migracji istniejących danych

**Wady:**
- Dodatkowa złożoność
- Potencjalne race conditions

### Opcja 3: Usuń foreign key constraint (NIE REKOMENDOWANE)

Zmienić schemat Prisma aby usunąć foreign key constraint.

**Zalety:**
- Szybkie rozwiązanie

**Wady:**
- Utrata integralności danych
- Może prowadzić do orphaned records
- Złe praktyki bazodanowe

## 📊 Statystyki błędów

- **Total build items**: 12
- **Failed build saves**: 12 (100%)
- **Successful avatar items**: 10
- **Error rate**: 100% dla builds, 0% dla avatars

## ✅ Co działa poprawnie

1. **Database connection**: Połączenie z PostgreSQL działa
2. **Schema validation**: Schema check passed
3. **Storage initialization**: Wszystkie storage systems initialized
4. **Avatar seeding**: Avatary są tworzone poprawnie (nie wymagają build data)
5. **Health checks**: Oba serwery odpowiadają na health checks
6. **WebSocket server**: Nasłuchuje poprawnie

## ⚠️ Ostrzeżenia

1. **Marketplace builds są niekompletne** - wszystkie próby zapisania build data failują
2. **File storage vs Database mismatch** - items w file storage, builds w database
3. **Production vs Development inconsistency** - seedMarketplace używa innego storage niż produkcja

## 🎯 Rekomendacje

### Natychmiastowe działanie
1. **Zmienić seedMarketplace.ts** aby używał `MarketplaceStorageDB` zamiast `MarketplaceStorage`
2. **Upewnić się że DATABASE_URL jest dostępny** podczas seedowania
3. **Przetestować seeding** po zmianie

### Długoterminowe
1. **Ujednolicić storage backend** - używać tylko database w produkcji i development
2. **Dodać migrację** z file storage do database dla istniejących danych
3. **Dodać testy integracyjne** dla seeding process
4. **Dokumentować** wymagania storage backend dla różnych środowisk

## 📝 Dodatkowe obserwacje

- **Mock players online**: Działa poprawnie (symulacja graczy online)
- **Thumbnail generation**: Działa poprawnie (wszystkie thumbnails wygenerowane)
- **Error handling**: Błędy są logowane, ale nie przerywają procesu seeding
- **Final message**: "✓ Successfully seeded 12 mock builds and 10 mock avatars!" - **misleading** - builds nie zostały zapisane!

## 🔧 Pliki do zmodyfikowania

1. `apps/net-server/src/scripts/seedMarketplace.ts` - zmienić storage backend
2. `apps/net-server/src/server.ts` - sprawdzić czy używa właściwego storage
3. Potencjalnie: `apps/net-server/src/storage/MarketplaceStorage.ts` - rozważyć deprecation

## Testowanie po naprawie

Po wprowadzeniu zmian należy:
1. Zatrzymać kontenery: `docker-compose down`
2. Usunąć volume z danymi: `docker volume rm nowyfolder4_db_data`
3. Uruchomić ponownie: `docker-compose up`
4. Sprawdzić logi czy build data są zapisywane poprawnie
5. Zweryfikować w bazie danych czy `marketplace_builds` zawiera dane

