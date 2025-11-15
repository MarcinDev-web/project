# Czyszczenie Bazy Danych i Cache

## 🗑️ Dostępne Komendy

### 1. Wyczyść tylko bazę danych (zachowuje schemat)

```bash
# Z root projektu
pnpm --filter @apps/net-server db:clear

# LUB bezpośrednio z apps/net-server
cd apps/net-server
pnpm db:clear
```

**Co robi:**
- Usuwa wszystkie dane z bazy danych (użytkownicy, forum, marketplace, shop, studio, itd.)
- **Zachowuje schemat bazy danych** (tabele pozostają)
- Nie usuwa plików JSON z folderu `data/`

### 2. Wyczyść bazę danych + cache JSON

```bash
pnpm --filter @apps/net-server db:clear:all
```

**Co robi:**
- Wszystko co powyżej +
- Usuwa wszystkie pliki JSON z folderu `data/` (cache)

### 3. Pełny reset bazy danych (usuwa i odtwarza schemat)

```bash
pnpm --filter @apps/net-server db:reset
```

**Co robi:**
- **Usuwa wszystkie tabele** i odtwarza schemat od nowa
- Uruchamia wszystkie migracje od początku
- ⚠️ **UWAGA:** To jest bardziej agresywne - usuwa całą strukturę bazy

## 📋 Co jest czyszczone

### Baza danych (db:clear):
- ✅ Użytkownicy (`users`)
- ✅ Forum (wątki, posty, reakcje, głosy)
- ✅ Marketplace (przedmioty, buildy, avatary, lajki, resale)
- ✅ Shop (przedmioty, assety, zakupy, owned items)
- ✅ Studio (projekty, zespoły, członkowie, zaproszenia, ustawienia, metryki)
- ✅ Avatar presets
- ✅ Game sessions
- ✅ Token blacklist
- ✅ Support tickets i FAQ

### Cache JSON (--clear-cache):
- ✅ Wszystkie pliki `.json` z folderu `data/`
- ✅ Zachowuje folder `data/thumbnails/` (nie usuwa miniatur)

## ⚠️ Ostrzeżenia

1. **Operacja nieodwracalna** - wszystkie dane zostaną trwale usunięte
2. **Upewnij się, że masz backup** jeśli potrzebujesz zachować dane
3. **ForumCategory nie jest czyszczone** - to są kategorie systemowe (możesz je usunąć ręcznie jeśli potrzebujesz)

## 🔄 Przykładowy workflow

```bash
# 1. Zatrzymaj serwer (Ctrl+C)

# 2. Wyczyść bazę danych
pnpm --filter @apps/net-server db:clear:all

# 3. (Opcjonalnie) Zresetuj migracje jeśli potrzebujesz
pnpm --filter @apps/net-server db:reset

# 4. Uruchom serwer ponownie
pnpm dev:server
```

## 💡 Uwagi

- Skrypt automatycznie wykrywa czy używasz bazy danych (`DATABASE_URL`) czy tylko JSON storage
- Jeśli nie masz `DATABASE_URL`, skrypt wyczyści tylko cache JSON
- Wszystkie operacje są bezpieczne - skrypt usuwa dane w odpowiedniej kolejności (respektując foreign keys)

