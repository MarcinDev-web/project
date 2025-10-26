import { EditorApp } from './app';
import { requireEditorDom } from './utils/dom';
import { assetRegistry } from '@engine/assets';
import { Logger } from './utils/logger';
import { registerBuiltInLogicCubes } from '@engine/script';
import { LogicCubeLibrary } from './editor/managers/LogicCubeLibrary';

export async function bootstrap(): Promise<void> {
  const { canvas, statusEl } = requireEditorDom();

  // Initialize Asset Registry
  try {
    statusEl.textContent = 'Loading assets...';
    await assetRegistry.initialize();
    Logger.info('Asset Registry initialized successfully');
  } catch (error) {
    Logger.error('Failed to initialize Asset Registry:', error as Error);
  }

  // Initialize Logic Cube System
  try {
    registerBuiltInLogicCubes();
    LogicCubeLibrary.initialize();
    Logger.info('Logic Cube System initialized successfully');
  } catch (error) {
    Logger.error('Failed to initialize Logic Cube System:', error as Error);
  }

  const app = new EditorApp({ canvas, statusEl });

  window.addEventListener(
    'beforeunload',
    () => {
      app.cleanup();
    },
    { once: true }
  );

  await app.start();
}

