# Analiza autentykacji - Net Server

**Data analizy:** 2025-01-26  
**Analizowane komponenty:** AuthManager, UserStorage, WebSocket authentication, REST API endpoints

---

## 📋 Spis treści

1. [Architektura autentykacji](#architektura-autentykacji)
2. [Przepływ autentykacji](#przepływ-autentykacji)
3. [Bezpieczeństwo](#bezpieczeństwo)
4. [Zidentyfikowane problemy](#zidentyfikowane-problemy)
5. [Rekomendacje](#rekomendacje)

---

## 🏗️ Architektura autentykacji

### Komponenty

```
apps/net-server/src/auth/
├── AuthManager.ts       # Główna logika autentykacji (JWT, bcrypt)
├── UserStorage.ts       # Przechowywanie użytkowników (JSON file-based)
└── middleware.ts        # Express middleware dla REST API

apps/net-server/src/websocket/
├── WebSocketHandler.ts  # Główny handler WebSocket
└── ReplicationServer.ts # Weryfikacja tokenów w WebSocket
```

### Technologie

- **JWT** (`jsonwebtoken`) - tokeny dostępu
- **bcrypt** - hashowanie haseł (10 rounds)
- **JSON file storage** - przechowywanie użytkowników
- **WebSocket** - połączenia real-time

---

## 🔄 Przepływ autentykacji

### 1. REST API - Rejestracja/Logowanie

```typescript
// POST /api/auth/register
User → Server → AuthManager.register()
  → bcrypt.hash(password) 
  → UserStorage.saveUser()
  → JWT.sign() (access + refresh token)
  → Response { user, session }

// POST /api/auth/login  
User → Server → AuthManager.login()
  → UserStorage.findUserByEmail()
  → bcrypt.compare(password, hash)
  → JWT.sign() (access + refresh token)
  → Response { user, session }
```

**Tokeny:**
- **Access token:** JWT z payload `{ userId, email }`, expires: `24h`
- **Refresh token:** JWT z payload `{ userId, email }`, expires: `7d`

### 2. REST API - Chronione endpointy

```typescript
// GET /api/auth/me
Request: Authorization: Bearer <token>
  → middleware.ts: createAuthMiddleware()
  → AuthManager.verifyToken(token)
  → jwt.verify(token, JWT_SECRET)
  → UserStorage.findUserById(payload.userId)
  → Attach user to req.user
  → Handler: authManager.getUserById()
```

### 3. WebSocket - Połączenie

```typescript
// Client connects → WebSocketHandler.handleConnection()
  → Sends welcome message (no auth required yet)

// Client sends: join-session message
{
  type: 'join-session',
  sessionId: string,
  token: string  // JWT token w message body
}

// ReplicationServer.handleJoinSession()
  → AuthManager.verifyToken(message.token)
  → jwt.verify(token, JWT_SECRET)
  → UserStorage.findUserById(payload.userId)
  → Register connection (ws → userId mapping)
  → SessionManager.joinSession()
```

**⚠️ Problem:** Token jest wysyłany w body wiadomości WebSocket, nie w headers.

### 4. WebSocket - Operacje po autentykacji

```typescript
// Po join-session, userId jest mapowany w connections Map
// Operacje (operation, player-update, cursor-update) używają userId z mapy
ReplicationServer.handleOperation()
  → getUserIdFromConnection(ws) // Pobiera userId z Map
  → Jeśli null → error 'NOT_AUTHENTICATED'
  → Broadcast do innych użytkowników w sesji
```

**⚠️ Problem:** Brak re-weryfikacji tokenu dla kolejnych operacji. Jeśli połączenie zostanie zhakowane, można używać go do czasu rozłączenia.

---

## 🔒 Bezpieczeństwo

### ✅ Silne strony

1. **Hashowanie haseł**
   - bcrypt z 10 rounds
   - Password hash nie jest nigdy zwracany do klienta

2. **JWT z refresh tokenami**
   - Access token: 24h (rozsądny czas)
   - Refresh token: 7d (długi czas dla UX)
   - Oddzielne sekrety dla access/refresh

3. **Walidacja danych wejściowych**
   - Email validation (sprawdzenie @)
   - Password minimum length (6 znaków)
   - Type checking w endpointach

4. **Isolacja danych wrażliwych**
   - `PublicUser` vs `User` (passwordHash nie wychodzi)
   - `toPublicUser()` helper

5. **Error handling**
   - Wspólne komunikaty błędów (nie ujawniają szczegółów)
   - Try-catch w kluczowych miejscach

### ⚠️ Słabe strony i problemy

#### 1. **KRYTYCZNE: JWT Secret w kodzie**

```typescript:12:13:apps/net-server/src/auth/AuthManager.ts
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '-refresh';
```

**Problem:** Jeśli `JWT_SECRET` nie jest ustawione w środowisku, używa domyślnej wartości `'change-me-in-production'`. To jest **bardzo niebezpieczne** w produkcji.

**Impact:** Każdy może podpisać własne tokeny.

**Rekomendacja:** 
- Wymusić ustawienie `JWT_SECRET` w środowisku produkcyjnym
- Zrzucić proces jeśli secret nie jest ustawiony w produkcji

#### 2. **Token w WebSocket message body**

```typescript:44:44:apps/net-server/src/types/websocket.ts
  token: string; // JWT token for authentication
```

**Problem:** Token jest wysyłany w body wiadomości WebSocket, nie w headers. To jest mniej standardowe i może być problematyczne dla proxy/cache.

**Impact:** Niski - funkcjonalnie działa, ale nie jest zgodne z najlepszymi praktykami.

**Rekomendacja:** Rozważyć użycie WebSocket subprotocol lub query parameter przy połączeniu.

#### 3. **Brak re-weryfikacji tokenu w WebSocket**

```typescript:167:173:apps/net-server/src/websocket/ReplicationServer.ts
  private async handleOperation(ws: WebSocket, message: OperationMessage): Promise<void> {
    try {
      const userId = this.getUserIdFromConnection(ws);
      if (!userId) {
        this.sendError(ws, 'Not authenticated', 'NOT_AUTHENTICATED');
        return;
      }
```

**Problem:** Po `join-session`, tylko userId jest mapowany. Kolejne operacje nie weryfikują czy token jest nadal ważny. Jeśli token wygaśnie lub zostanie odwołany, użytkownik nadal może wysyłać operacje.

**Impact:** Średni - tokeny wygasają po 24h, ale jeśli token zostanie skompromitowany, nie można go odwołać przed wygaśnięciem.

**Rekomendacja:** 
- Cache token expiration time w connection mapping
- Weryfikować expiration przed akceptowaniem operacji
- Rozważyć token blacklist dla revoked tokens

#### 4. **Brak rate limiting**

**Problem:** Brak ochrony przed brute-force atakami na endpointy `/api/auth/login` i `/api/auth/register`.

**Impact:** Średni - można próbować odgadnąć hasła lub spamować rejestracje.

**Rekomendacja:** Dodać rate limiting (np. express-rate-limit) dla endpointów auth.

#### 5. **Brak walidacji siły hasła**

```typescript:44:46:apps/net-server/src/auth/AuthManager.ts
    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
```

**Problem:** Tylko minimalna długość (6 znaków). Brak wymagań dotyczących złożoności (wielkie litery, cyfry, znaki specjalne).

**Impact:** Niski - użytkownicy mogą używać słabych haseł.

**Rekomendacja:** Dodać walidację siły hasła (opcjonalnie).

#### 6. **Brak CORS config**

```typescript:27:27:apps/net-server/src/server.ts
app.use(cors());
```

**Problem:** CORS jest włączony dla wszystkich origins (`cors()` bez opcji). To może być niebezpieczne jeśli API jest publiczne.

**Impact:** Średni - jeśli frontend jest na innym domenie, może być problem.

**Rekomendacja:** Skonfigurować CORS dla konkretnych origins w produkcji.

#### 7. **Brak HTTPS enforcement**

**Problem:** Brak wymuszania HTTPS w produkcji. Tokeny JWT są przesyłane plaintext jeśli nie ma HTTPS.

**Impact:** Wysoki - jeśli brak HTTPS, tokeny mogą być przechwycone.

**Rekomendacja:** Wymusić HTTPS w produkcji, przekierować HTTP → HTTPS.

#### 8. **Placeholder w SessionManager**

```typescript:160:167:apps/net-server/src/websocket/SessionManager.ts
  private getPublicUser(userId: string): PublicUser {
    // This is a placeholder - in real implementation, fetch from AuthManager
    return {
      id: userId,
      email: 'unknown@example.com',
      createdAt: Date.now(),
    };
  }
```

**Problem:** Metoda `getPublicUser()` zwraca placeholder zamiast pobierać dane z AuthManager.

**Impact:** Niski - jest używana tylko w `createSession()` gdy tworzy się sesję bez pełnych danych użytkownika. `setUserData()` aktualizuje to później.

**Rekomendacja:** Przekazać AuthManager do SessionManager lub usunąć tę metodę jeśli nie jest używana.

#### 9. **Brak token blacklist**

**Problem:** Nie ma mechanizmu odwoływania tokenów przed wygaśnięciem. Jeśli token zostanie skompromitowany, nie można go odwołać.

**Impact:** Średni - dla większości przypadków użycia wygaśnięcie po 24h jest akceptowalne, ale dla wrażliwych aplikacji może być problem.

**Rekomendacja:** Rozważyć token blacklist (Redis/database) dla przypadków gdy potrzebne jest odwołanie tokenów.

#### 10. **Brak walidacji sesji w refresh**

```typescript:109:122:apps/net-server/src/auth/AuthManager.ts
  async refreshSession(refreshToken: string): Promise<Session | null> {
    try {
      const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JWTPayload;
      const user = await this.userStorage.findUserById(payload.userId);
      
      if (!user) {
        return null;
      }

      return await this.createSession(user);
    } catch (error) {
      return null;
    }
  }
```

**Problem:** Refresh token jest akceptowany jeśli użytkownik istnieje, nawet jeśli został usunięty/zablokowany między refreshami.

**Impact:** Niski - jeśli użytkownik zostanie usunięty, refresh token nadal działa do wygaśnięcia (7d).

**Rekomendacja:** Rozważyć dodanie flagi `active` do użytkownika lub token blacklist.

---

## 🐛 Zidentyfikowane problemy

### 🔴 Krytyczne (wymagają natychmiastowej naprawy)

1. **JWT Secret z domyślną wartością**
   - Lokalizacja: `AuthManager.ts:12`
   - Ryzyko: Kompromitacja wszystkich tokenów w produkcji
   - Priorytet: **WYSOKI**

### 🟡 Wysokie (naprawić przed produkcją)

2. **Brak re-weryfikacji tokenu w WebSocket operacjach**
   - Lokalizacja: `ReplicationServer.ts:167-188`
   - Ryzyko: Kompromitowany token działa do wygaśnięcia
   - Priorytet: **ŚREDNI**

3. **Brak rate limiting**
   - Lokalizacja: Wszystkie endpointy auth
   - Ryzyko: Brute-force ataki
   - Priorytet: **ŚREDNI**

4. **Brak HTTPS enforcement**
   - Lokalizacja: `server.ts`
   - Ryzyko: Tokeny mogą być przechwycone
   - Priorytet: **WYSOKI**

### 🟢 Średnie (poprawić w następnej iteracji)

5. Token w WebSocket message body (zamiast headers)
6. Brak walidacji siły hasła
7. CORS bez konfiguracji
8. Brak token blacklist
9. Placeholder w SessionManager.getPublicUser()

### 🔵 Niskie (nice to have)

10. Refresh token bez sprawdzania statusu użytkownika

---

## 💡 Rekomendacje

### Krótkoterminowe (przed produkcją)

1. **Wymusić JWT_SECRET w środowisku**
   ```typescript
   if (!process.env.JWT_SECRET) {
     throw new Error('JWT_SECRET must be set in production');
   }
   ```

2. **Dodać rate limiting**
   ```typescript
   import rateLimit from 'express-rate-limit';
   
   const authLimiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 5 // 5 requests per window
   });
   
   app.post('/api/auth/login', authLimiter, ...);
   app.post('/api/auth/register', authLimiter, ...);
   ```

3. **Skonfigurować CORS**
   ```typescript
   import {
     getCorsConfig,
     isOriginAllowed,
     describeAllowedOrigins,
     CORS_ALLOWED_HEADERS,
     CORS_ALLOWED_METHODS,
   } from '@shared/config/cors';

   const corsConfig = getCorsConfig();
   const allowedOriginsDescription = describeAllowedOrigins(corsConfig);

   app.use(cors({
     origin: (origin, callback) => {
       if (!origin || isOriginAllowed(origin, corsConfig)) {
         return callback(null, true);
       }
       console.warn(`Blocked CORS origin: ${origin}. Allowed: ${allowedOriginsDescription}`);
       return callback(new Error('Not allowed by CORS'));
     },
     credentials: true,
     allowedHeaders: CORS_ALLOWED_HEADERS,
     methods: CORS_ALLOWED_METHODS,
     maxAge: 86400,
   }));
   ```

4. **Wymusić HTTPS w produkcji**
   ```typescript
   if (process.env.NODE_ENV === 'production') {
     app.use((req, res, next) => {
       if (req.header('x-forwarded-proto') !== 'https') {
         res.redirect(`https://${req.header('host')}${req.url}`);
       } else {
         next();
       }
     });
   }
   ```

### Średnioterminowe (następna iteracja)

5. **Re-weryfikacja tokenu w WebSocket**
   - Cache expiration time w connection mapping
   - Sprawdzać expiration przed operacjami
   - Rozważyć okresową re-weryfikację (np. co 5 minut)

6. **Token blacklist**
   - Dodać Redis lub database dla blacklisted tokens
   - Sprawdzać blacklist w `verifyToken()`
   - Endpoint `/api/auth/logout` do dodania tokenu do blacklist

7. **Walidacja siły hasła**
   - Minimum 8 znaków
   - Wymagane: wielkie litery, cyfry
   - Opcjonalne: znaki specjalne

8. **Poprawić SessionManager**
   - Przekazać AuthManager do SessionManager
   - Użyć AuthManager.getUserById() zamiast placeholder

### Długoterminowe (future improvements)

9. **Refresh token rotation**
   - Wydawać nowy refresh token przy każdym refresh
   - Unieważniać stary refresh token

10. **Session management**
    - Endpoint do listowania aktywnych sesji
    - Możliwość wylogowania z konkretnej sesji
    - Webhook/event gdy użytkownik loguje się z nowego urządzenia

11. **Two-factor authentication (2FA)**
    - Opcjonalna 2FA dla wrażliwych operacji
    - TOTP lub SMS

12. **Audit logging**
    - Logować wszystkie próby logowania (sukces/porażka)
    - Logować token refresh
    - Logować podejrzane aktywności (np. wiele prób z różnych IP)

---

## 📊 Podsumowanie

### Ocena ogólna: **7/10**

**Mocne strony:**
- ✅ Dobra architektura (separation of concerns)
- ✅ Bezpieczne hashowanie haseł
- ✅ JWT z refresh tokenami
- ✅ Dobra izolacja danych wrażliwych

**Do poprawy:**
- ⚠️ JWT_SECRET z domyślną wartością (KRYTYCZNE)
- ⚠️ Brak rate limiting
- ⚠️ Brak HTTPS enforcement
- ⚠️ Brak re-weryfikacji tokenu w WebSocket

**Gotowość do produkcji:** **Nie** (z powodu JWT_SECRET i braku HTTPS enforcement)

**Priorytet napraw:** 
1. JWT_SECRET (krytyczne)
2. HTTPS enforcement (wysokie)
3. Rate limiting (średnie)
4. Re-weryfikacja tokenu (średnie)

---

**Autor:** AI Assistant  
**Data:** 2025-01-26

