# Vercel Deployment Guide

## Konfiguracja projektu dla Vercel

Projekt został przygotowany do deploy na Vercel. Aplikacja platformowa (`apps/platform`) zostanie zbudowana i wdrożona.

## Struktura konfiguracji

- `vercel.json` - konfiguracja Vercel dla monorepo
- Build command: `pnpm build:platform`
- Output directory: `apps/platform/dist`

## Kroki do wdrożenia

1. **Połącz projekt z Vercel:**
   ```bash
   # Zainstaluj Vercel CLI (jeśli nie masz)
   npm i -g vercel
   
   # Zaloguj się
   vercel login
   
   # Połącz projekt z GitHub repo
   vercel link
   ```

2. **Ustawienia w Vercel Dashboard:**
   - Framework Preset: **Vite**
   - Root Directory: *(zostaw puste - monorepo root)*
   - Build Command: `pnpm build:platform` *(już ustawione w vercel.json)*
   - Output Directory: `apps/platform/dist` *(już ustawione w vercel.json)*
   - Install Command: `pnpm install` *(już ustawione w vercel.json)*

3. **Zmienne środowiskowe:**
   
   Jeśli aplikacja komunikuje się z backendem:
   - `VITE_API_URL` - absolutny URL do backend API (musi kończyć się na `/api`)
   - `VITE_WS_URL` - absolutny URL do WebSocket (`/ws`)
   
   W Vercel Dashboard: Settings → Environment Variables

4. **Deploy:**
   ```bash
   # Deploy do preview
   vercel
   
   # Deploy do production
   vercel --prod
   ```

## Proxy API

Aplikacja używa proxy `/api` który w dev mode kieruje na `http://localhost:3000`. 

Dla produkcji możesz:
- Użyć Vercel Rewrites w `vercel.json` aby proxy `/api` na zewnętrzny backend
- Użyć zmiennej środowiskowej `VITE_API_URL` aby wskazać bezpośrednio na backend

## WebSocket

Aplikacja używa WebSocket do real-time komunikacji. Upewnij się, że:
- Backend WebSocket jest dostępny z domeny Vercel (lub użyj proxy)
- Ustaw odpowiedni URL WebSocket w kodzie (sprawdź `WebSocketManager.ts`)

## Troubleshooting

### Build fails
- Upewnij się, że wszystkie zależności są w `package.json`
- Sprawdź czy `pnpm install` działa lokalnie
- Sprawdź logi build w Vercel Dashboard

### API/WS calls fail
- Sprawdź czy backend API/WS jest dostępny
- Ustaw `VITE_API_URL` i `VITE_WS_URL`
- Sprawdź CORS settings na backendzie

### WebSocket fails
- Upewnij się, że backend WebSocket jest dostępny pod `/ws`
- Sprawdź czy używasz wss:// (secure WebSocket) dla HTTPS
- Jeśli używasz Railway, backend WS działa na tym samym porcie co HTTP

