import { EditorApp } from './app';
import { requireEditorDom } from './utils/dom';
import { Logger } from './utils/logger';
import { registerBuiltInLogicCubes } from '@engine/script';
import { LogicCubeLibrary } from '@engine/editor-utils';
import { ensureWasmCollisionInit } from './wasm/collision';
import { TerrainMeshGenerator } from '@engine/voxel/terrain';
import { warmupCollisionWorker } from './wasm/collisionWorkerClient';
import { CollabClient } from './editor/net/collab';
import { EOSClient } from './bootstrap/EOSClient';

export async function bootstrap(): Promise<void> {
  const { canvas, statusEl } = requireEditorDom();

  // Parse URL params once
  const urlParams = new URLSearchParams(window.location.search);
  const shareToken = urlParams.get('share');
  const collabSession = urlParams.get('session');
  const projectId = urlParams.get('project') || 'default-project';
  
  // Get token from URL (passed from platform) and store in localStorage
  const tokenFromUrl = urlParams.get('token');
  const refreshTokenFromUrl = urlParams.get('refreshToken');
  
  Logger.info(`Editor: URL params - token: ${tokenFromUrl ? 'present' : 'missing'}, refreshToken: ${refreshTokenFromUrl ? 'present' : 'missing'}`);
  Logger.info(`Editor: Current URL: ${window.location.href}`);
  
  if (tokenFromUrl) {
    try {
      const { setTokens, getTokens: getStoredTokens } = await import('./utils/auth');
      const stored = getStoredTokens();
      Logger.info(`Editor: Current localStorage token: ${stored.token ? 'present' : 'missing'}`);
      
      // Only set if not already stored or different
      if (!stored.token || stored.token !== tokenFromUrl) {
        // Use refreshToken from URL if provided, otherwise keep existing one
        const refreshToken = refreshTokenFromUrl || stored.refreshToken || '';
        setTokens(tokenFromUrl, refreshToken);
        Logger.info('Editor: Token received from platform and stored in localStorage');
        
        // Verify it was stored
        const verify = getStoredTokens();
        if (verify.token === tokenFromUrl) {
          Logger.info('Editor: Token successfully verified in localStorage');
        } else {
          Logger.warn('Editor: Token storage verification failed!');
        }
        
        // Clean up URL by removing token parameters
        urlParams.delete('token');
        urlParams.delete('refreshToken');
        const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
        window.history.replaceState({}, '', newUrl);
      } else {
        Logger.info('Editor: Token already exists in localStorage, skipping');
      }
    } catch (error) {
      Logger.warn('Editor: Failed to store token from URL:', error as Error);
    }
  } else {
    Logger.info('Editor: No token in URL - checking localStorage for existing token');
    try {
      const { getTokens: getStoredTokens } = await import('./utils/auth');
      const stored = getStoredTokens();
      Logger.info(`Editor: localStorage token: ${stored.token ? 'present' : 'missing'}`);
      
      // If no token in URL and no token in localStorage, check if we came from platform
      // by checking if URL has authenticated=true parameter
      if (!stored.token && urlParams.get('authenticated') === 'true') {
        Logger.warn('Editor: URL has authenticated=true but no token - platform may not have passed token correctly');
        Logger.warn('Editor: This usually means platform localStorage is empty or token was not available');
      }
    } catch (error) {
      Logger.warn('Editor: Failed to check localStorage:', error as Error);
    }
  }

  // Check authentication status from platform
  try {
    const { getCurrentUser } = await import('./utils/auth');
    const currentUser = await getCurrentUser();
    if (currentUser) {
      Logger.info(`Editor: User authenticated as ${currentUser.email}`);
    } else {
      Logger.info('Editor: No authenticated user found');
    }
  } catch (error) {
    Logger.warn('Editor: Failed to check authentication status:', error as Error);
  }

  // Removed: Asset Registry initialization (no longer needed)

  // Initialize Logic Cube System
  try {
    registerBuiltInLogicCubes();
    LogicCubeLibrary.initialize();
  } catch (error) {
    Logger.error('Failed to initialize Logic Cube System:', error as Error);
  }

  const eosClient = new EOSClient({
    sanctionsEndpoint: import.meta.env?.VITE_EOS_SANCTIONS_URL ?? '/trust/eos/events',
    reportsEndpoint: import.meta.env?.VITE_EOS_REPORT_URL ?? '/trust/reports',
    telemetryEndpoint: import.meta.env?.VITE_EOS_TELEMETRY_URL ?? '/trust/telemetry/intent',
    enabled: import.meta.env?.VITE_ENABLE_EOS !== 'false',
  });
  try {
    await eosClient.initialize();
  } catch (error) {
    Logger.warn('EOS client init failed', error as Error);
  }

  const app = new EditorApp({ 
    canvas, 
    statusEl,
    eosClient 
  });

  // Background warm-up: init WASM (in-thread) and Worker to avoid first-use jank
  try {
    ensureWasmCollisionInit();
    TerrainMeshGenerator.init();
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
      const collabClient = new CollabClient();
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
        const auth = await collabClient.login(email, password);
        token = auth.session.token;
        window.localStorage.setItem('COLLAB_SESSION', JSON.stringify(auth.session));
      }

      if (!token) throw new Error('Missing token');
      // Ensure session exists (idempotent)
      const sessionId = await collabClient.createSession(token, projectId, collabSession);
      const client = collabClient.createReplicationClient(token);
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
            await collabClient.saveSnapshot(token!, projectId, sessionId, { scene: json });
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
        const latest = await collabClient.loadLatestSnapshot(token, projectId);
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
