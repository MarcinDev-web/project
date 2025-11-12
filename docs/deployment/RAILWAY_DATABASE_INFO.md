# Railway Database - Informacje o Endpointach

## 📋 Co oznaczają informacje o bazie danych w Railway?

Gdy dodasz PostgreSQL Database w Railway, zobaczysz kilka endpointów:

### 1. HTTP Domain
```
net-server-db-production.up.railway.app
```

**Co to jest:**
- HTTP endpoint do bazy danych używany wewnętrznie przez Railway
- Railway używa tego do zarządzania i monitorowania bazy

**Czy potrzebujesz tego używać?**
- ❌ **NIE** - Railway automatycznie używa tego wewnętrznie
- Railway automatycznie ustawi `DATABASE_URL` w serwisie `net-server` z prawidłowym connection string

---

### 2. TCP Proxy Endpoints
```
interchange.proxy.rlwy.net:17882
mainline.proxy.rlwy.net:40666
```

**Co to jest:**
- Proksowane porty TCP do bezpośredniego połączenia z bazą danych
- Używane do połączeń z zewnętrznych narzędzi (pgAdmin, DBeaver, psql, etc.)

**Kiedy używać:**
- ✅ Gdy chcesz połączyć się z bazą lokalnie (np. pgAdmin, DBeaver)
- ✅ Gdy potrzebujesz wykonać query ręcznie
- ❌ **NIE potrzebujesz tego dla aplikacji** - Railway automatycznie ustawia `DATABASE_URL`

**Przykład użycia z psql:**
```bash
psql "postgresql://user:password@interchange.proxy.rlwy.net:17882/dbname?sslmode=require"
```

**Przykład użycia z pgAdmin:**
- Host: `interchange.proxy.rlwy.net`
- Port: `17882`
- Database: *(nazwa z DATABASE_URL)*
- Username: *(user z DATABASE_URL)*
- Password: *(hasło z DATABASE_URL)*
- SSL Mode: `require`

---

## ✅ Co Railway robi automatycznie?

1. **Ustawia `DATABASE_URL` w serwisie `net-server`:**
   - Automatycznie dodaje connection string
   - Automatycznie dodaje `sslmode=require`
   - Udostępnia bazę dla wszystkich serwisów w projekcie

2. **Zarządza połączeniami:**
   - Railway używa HTTP Domain wewnętrznie
   - Aplikacja używa `DATABASE_URL` automatycznie
   - Nie musisz ręcznie konfigurować endpointów

---

## 🔍 Jak sprawdzić czy wszystko działa?

1. **Sprawdź zmienną `DATABASE_URL`:**
   - Railway Dashboard → `net-server` → **Variables**
   - Powinieneś zobaczyć `DATABASE_URL` automatycznie ustawione
   - Format: `postgresql://user:password@host:port/database?sslmode=require`

2. **Sprawdź logi aplikacji:**
   - Railway Dashboard → `net-server` → **Logs**
   - Szukaj: `✅ Database connected` lub podobnego komunikatu
   - Jeśli widzisz błędy połączenia, sprawdź czy `DATABASE_URL` jest ustawione

---

## 🛠️ Ręczne połączenie z bazą (opcjonalne)

Jeśli potrzebujesz połączyć się z bazą lokalnie:

1. **Użyj `DATABASE_URL` z Railway Variables:**
   ```bash
   # Skopiuj DATABASE_URL z Railway Variables
   # Zastąp host:port na TCP proxy endpoint
   psql "postgresql://user:password@interchange.proxy.rlwy.net:17882/database?sslmode=require"
   ```

2. **Lub użyj pgAdmin:**
   - Host: `interchange.proxy.rlwy.net`
   - Port: `17882` (lub drugi endpoint: `40666`)
   - Database, Username, Password: z `DATABASE_URL`

---

## ⚠️ Ważne uwagi

- **Dla aplikacji:** Używaj tylko `DATABASE_URL` ustawionej przez Railway
- **HTTP Domain:** Tylko dla Railway wewnętrznie
- **TCP Proxy:** Tylko do ręcznego połączenia lokalnego
- **Nie zmieniaj ręcznie `DATABASE_URL`** - Railway zarządza tym automatycznie

---

## 📚 Zobacz też

- `docs/ENV_VARIABLES.md` - Wszystkie zmienne środowiskowe
- `docs/DEPLOYMENT_STEP_BY_STEP.md` - Kompletna instrukcja wdrożenia

