# Vercel Deployment - Troubleshooting

## Problem: Stara wersja na produkcji

Jeśli zmiany nie pojawiają się na Vercel:

### 1. Sprawdź czy Vercel zrebuildował
- Vercel Dashboard → Deployments
- Sprawdź czy ostatni deployment jest z najnowszego commita
- Jeśli nie, kliknij "Redeploy" na najnowszym commicie

### 2. Wymuś rebuild
```bash
# Dodaj pusty commit aby wymusić rebuild
git commit --allow-empty -m "chore: Trigger Vercel rebuild"
git push
```

### 3. Sprawdź backend na Railway
- Backend musi zwracać `username` w odpowiedzi `/auth/me`
- Sprawdź czy Railway zrebuildował backend z najnowszymi zmianami

### 4. Wyczyść cache przeglądarki
- Hard refresh: Ctrl+Shift+R (Windows) lub Cmd+Shift+R (Mac)
- Lub otwórz w trybie incognito

## Sprawdzenie czy backend zwraca username

```bash
# Sprawdź odpowiedź backendu (zastąp TOKEN swoim tokenem)
curl https://your-railway-backend.railway.app/api/auth/me \
  -H "Authorization: Bearer TOKEN"

# Powinno zwracać:
# {
#   "id": "...",
#   "email": "...",
#   "username": "...",  // <-- To musi być!
#   "createdAt": ...,
#   "role": "..."
# }
```

## Rozwiązanie

1. **Sprawdź Railway** - czy backend został zrebuildowany
2. **Sprawdź Vercel** - czy frontend został zrebuildowany  
3. **Wymuś rebuild** jeśli potrzeba
4. **Wyczyść cache** przeglądarki

