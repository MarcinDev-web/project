# Release Management API

Dokumentacja endpointów API wymaganych do działania Release Management UI w platformie.

## Endpointy

### GET `/admin/releases`

Pobiera listę wszystkich release'ów.

**Response:**
```json
{
  "releases": [
    {
      "id": "release-123",
      "tag": "v1.0.1",
      "version": "1.0.1",
      "type": "patch",
      "status": "success",
      "createdAt": 1706284800000,
      "createdBy": "user-123",
      "changelog": "## Changes\n\n- fix: resolve memory leak\n- feat: add new feature",
      "githubReleaseUrl": "https://github.com/owner/repo/releases/tag/v1.0.1"
    }
  ],
  "total": 10
}
```

**Status codes:**
- `200` - Success
- `401` - Unauthorized
- `403` - Forbidden (not admin)

---

### GET `/admin/releases/stats`

Pobiera statystyki release'ów.

**Response:**
```json
{
  "total": 10,
  "byType": {
    "major": 1,
    "minor": 5,
    "patch": 4
  },
  "lastRelease": {
    "tag": "v1.0.1",
    "version": "1.0.1",
    "createdAt": 1706284800000
  },
  "currentVersion": "1.0.1"
}
```

**Status codes:**
- `200` - Success
- `401` - Unauthorized
- `403` - Forbidden (not admin)

---

### POST `/admin/releases`

Tworzy nowy release poprzez wywołanie GitHub Actions workflow.

**Request body:**
```json
{
  "versionType": "patch"
}
```

**versionType** może być: `"major"`, `"minor"`, lub `"patch"`

**Response:**
```json
{
  "success": true,
  "message": "Release workflow started successfully",
  "workflowRunId": "12345678"
}
```

**Status codes:**
- `200` - Success (workflow started)
- `400` - Bad request (invalid versionType)
- `401` - Unauthorized
- `403` - Forbidden (not admin)
- `500` - Internal server error (failed to trigger workflow)

---

## Integracja z GitHub Actions

Backend powinien wywołać GitHub Actions workflow używając GitHub API:

```typescript
// Przykład implementacji (Node.js)
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function triggerReleaseWorkflow(versionType: 'major' | 'minor' | 'patch') {
  const response = await octokit.rest.actions.createWorkflowDispatch({
    owner: 'your-org',
    repo: 'your-repo',
    workflow_id: 'release.yml', // Nazwa pliku workflow
    ref: 'main', // Branch
    inputs: {
      version: versionType,
    },
  });
  
  return response.data;
}
```

**Wymagane zmienne środowiskowe:**
- `GITHUB_TOKEN` - Personal Access Token z uprawnieniami do wywoływania workflow

**Uprawnienia wymagane dla tokenu:**
- `actions:write` - Aby wywołać workflow
- `contents:read` - Aby odczytać workflow

---

## Przechowywanie danych release'ów

Dane release'ów mogą być przechowywane w:
1. **Bazie danych** - Tabela `releases` z polami zgodnymi z interfejsem `Release`
2. **GitHub API** - Pobieranie danych bezpośrednio z GitHub Releases API
3. **Hybrydowo** - Cache w bazie danych, aktualizacja z GitHub API

### Przykładowa struktura tabeli (Prisma)

```prisma
model Release {
  id                String   @id @default(cuid())
  tag               String   @unique
  version           String
  type              String   // "major" | "minor" | "patch"
  status            String   // "pending" | "running" | "success" | "failed"
  createdAt         DateTime @default(now())
  createdBy         String?
  changelog         String?  @db.Text
  githubReleaseUrl String?
  workflowRunId     String?
  
  @@index([status])
  @@index([createdAt])
}
```

---

## Synchronizacja statusu

Status release'ów powinien być synchronizowany z GitHub Actions:

1. **Webhook** - GitHub Actions może wysyłać webhook po zakończeniu workflow
2. **Polling** - Backend może okresowo sprawdzać status workflow przez GitHub API
3. **Hybrydowo** - Webhook dla szybkiej aktualizacji, polling jako backup

### Przykład webhook handlera

```typescript
// POST /webhooks/github
app.post('/webhooks/github', async (req, res) => {
  const { workflow_run } = req.body;
  
  if (workflow_run.name === 'Release') {
    const status = workflow_run.status === 'completed' 
      ? (workflow_run.conclusion === 'success' ? 'success' : 'failed')
      : 'running';
    
    await updateReleaseStatus(workflow_run.id, status);
  }
  
  res.status(200).send('OK');
});
```

---

## Przykład implementacji (Express.js)

```typescript
import express from 'express';
import { adminApi } from './api/admin';

const router = express.Router();

// Middleware do sprawdzania uprawnień admina
router.use(requireAdmin);

router.get('/admin/releases', async (req, res) => {
  try {
    const releases = await getReleasesFromDB();
    res.json({ releases, total: releases.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch releases' });
  }
});

router.get('/admin/releases/stats', async (req, res) => {
  try {
    const stats = await calculateReleaseStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.post('/admin/releases', async (req, res) => {
  const { versionType } = req.body;
  
  if (!['major', 'minor', 'patch'].includes(versionType)) {
    return res.status(400).json({ error: 'Invalid versionType' });
  }
  
  try {
    const workflowRun = await triggerGitHubWorkflow(versionType);
    
    // Zapisz release do bazy danych ze statusem "pending"
    const release = await createRelease({
      type: versionType,
      status: 'pending',
      workflowRunId: workflowRun.id.toString(),
    });
    
    res.json({
      success: true,
      message: 'Release workflow started successfully',
      workflowRunId: workflowRun.id.toString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger release workflow' });
  }
});

export default router;
```

---

## Uwagi implementacyjne

1. **Bezpieczeństwo**: Wszystkie endpointy wymagają uprawnień admina
2. **Rate limiting**: GitHub API ma limity - rozważ cache'owanie
3. **Error handling**: Obsłuż błędy GitHub API gracefully
4. **Logging**: Loguj wszystkie operacje release'ów dla audytu
5. **Validation**: Waliduj `versionType` przed wywołaniem workflow

---

## Testowanie

### Test manualny

```bash
# Pobierz release'y
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/releases

# Pobierz statystyki
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/releases/stats

# Utwórz release
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"versionType":"patch"}' \
  http://localhost:3000/admin/releases
```

---

**Ostatnia aktualizacja:** 2025-01-26  
**Status:** Wymaga implementacji backendu

