import { EditorApp } from './app';
import { requireEditorDom } from './utils/dom';
import { Logger } from './utils/logger';
import { registerBuiltInLogicCubes } from '@engine/script';
import { LogicCubeLibrary } from './editor/managers/LogicCubeLibrary';
import { ensureWasmCollisionInit } from './wasm/collision';
import { warmupCollisionWorker } from './wasm/collisionWorkerClient';

export async function bootstrap(): Promise<void> {
  const { canvas, statusEl } = requireEditorDom();

  // Removed: Asset Registry initialization (no longer needed)

  // Initialize Logic Cube System
  try {
    registerBuiltInLogicCubes();
    LogicCubeLibrary.initialize();
    Logger.info('Logic Cube System initialized successfully');
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

  await app.start();
}

