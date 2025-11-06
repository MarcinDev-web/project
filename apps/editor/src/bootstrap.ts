import { EditorApp } from './app';
import { requireEditorDom } from './utils/dom';
import { Logger } from './utils/logger';
import { registerBuiltInLogicCubes } from '@engine/script';
import { LogicCubeLibrary } from '@engine/editor-utils';
import { ensureWasmCollisionInit } from './wasm/collision';
import { warmupCollisionWorker } from './wasm/collisionWorkerClient';
import { login, createReplicationClient, createSession, saveSnapshot, loadLatestSnapshot } from './editor/net/collab';
import { runIntro } from './intro';

export async function bootstrap(): Promise<void> {
  const { canvas, statusEl } = requireEditorDom();

  // Parse URL params once
  const urlParams = new URLSearchParams(window.location.search);
  const skipIntro = urlParams.get('skipIntro') === 'true';
  const shareToken = urlParams.get('share');
  const collabSession = urlParams.get('session');
  const projectId = urlParams.get('project') || 'default-project';

  // 🎬 EPIC INTRO SEQUENCE
  // Show cinematic intro unless explicitly skipped via URL param
  if (!skipIntro) {
    try {
      await runIntro(canvas, 5); // 5 second intro
    } catch (error) {
      Logger.warn('Intro sequence failed, continuing to app:', error as Error);
    }
  }

  // Removed: Asset Registry initialization (no longer needed)

  // Initialize Logic Cube System
  try {
    registerBuiltInLogicCubes();
    LogicCubeLibrary.initialize();
  } catch (error) {
    Logger.error('Failed to initialize Logic Cube System:', error as Error);
  }

  const app = new EditorApp({ canvas, statusEl });

  // Background warm-up: init WASM (in-thread) and Worker to avoid first-use jank
  try {
    ensureWasmCollisionInit();
    warmupCollisionWorker();
  } catch {}

  window.addEventListener(
    'beforeunload',
    () => {
      app.cleanup();
    },
    { once: true }
  );

  // Start app first
  await app.start();

  // Load shared project if token is present
  if (shareToken) {
    try {
      await app.loadSharedProject(shareToken);
    } catch (error) {
      Logger.error('Failed to load shared project:', error as Error);
      // Continue with normal app startup even if share fails
    }
  }

  // Minimal collab integration (opt-in via ?session=...)
  if (collabSession) {
    try {
      const stored = window.localStorage.getItem('COLLAB_SESSION');
      let token: string | null = null;
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { token: string; expiresAt: number };
          if (!parsed.expiresAt || parsed.expiresAt > Date.now()) {
            token = parsed.token;
          }
        } catch {}
      }

      if (!token) {
        const email = window.prompt('Email for collaboration login:') || '';
        const password = window.prompt('Password:') || '';
        const auth = await login(email, password);
        token = auth.session.token;
        window.localStorage.setItem('COLLAB_SESSION', JSON.stringify(auth.session));
      }

      if (!token) throw new Error('Missing token');
      // Ensure session exists (idempotent)
      const sessionId = await createSession(token, projectId, collabSession);
      const client = createReplicationClient(token);
      await client.connect(sessionId);

      // Expose minimal selection broadcasting helper
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__collabSendSelection = (ids: string[]) => {
        try {
          const opId = (crypto as unknown as { randomUUID: () => string }).randomUUID?.() || String(Date.now());
          client.sendOperation({
            id: opId,
            type: 'selection-change',
            timestamp: Date.now(),
            userId: '',
            data: { selectedIds: ids },
          } as unknown as any);
        } catch {}
      };

      // Bind Ctrl+Shift+S to save snapshot
      window.addEventListener('keydown', async (ev) => {
        if (ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === 's') {
          try {
            const payload = (app as unknown as { scene: unknown })['scene'];
            // Scene has toJSON
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const json = (payload as any).toJSON ? (payload as any).toJSON() : payload;
            await saveSnapshot(token!, projectId, sessionId, { scene: json });
            Logger.info('Snapshot saved');
          } catch (err) {
            Logger.warn('Snapshot save failed', err as Error);
          }
        }
      });

      // Presence: send cursor position occasionally
      let lastSent = 0;
      window.addEventListener('mousemove', (ev) => {
        const now = Date.now();
        if (now - lastSent < 100) return; // 10 Hz
        lastSent = now;
        // Normalize to viewport [-1,1]
        const nx = (ev.clientX / window.innerWidth) * 2 - 1;
        const ny = (ev.clientY / window.innerHeight) * 2 - 1;
        try {
          client.sendCursorUpdate([nx, ny, 0]);
        } catch {}
      });

      // Try to load latest snapshot on start
      try {
        const latest = await loadLatestSnapshot(token, projectId);
        if (latest && typeof latest === 'object' && (latest as Record<string, unknown>)['scene']) {
          const sceneJson = (latest as Record<string, unknown>)['scene'];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const SceneCtor = (await import('@engine/world')).Scene as any;
          const newScene = SceneCtor.fromJSON(sceneJson);
          // Replace current scene entities
          const current = (app as unknown as { scene: any })['scene'];
          current.clear();
          for (const entity of newScene.rootEntities) {
            current.addEntity(entity);
          }
          current.name = newScene.name;
          Logger.info('Loaded latest snapshot');
        }
      } catch {}
    } catch (err) {
      Logger.warn('Collab bootstrap failed', err as Error);
    }
  }
}

