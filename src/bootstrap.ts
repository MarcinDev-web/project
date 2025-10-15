import { EditorApp } from './app';
import { requireEditorDom } from './utils/dom';
import { assetRegistry } from './editor/assets/AssetRegistry';
import { initializeAssetLibrary } from './editor/assets/AssetLibrary';
import { Logger } from './logger';
import { registerBuiltInLogicCubes } from './logic/cubes';
import { LogicCubeLibrary } from './editor/managers/LogicCubeLibrary';

export async function bootstrap(): Promise<void> {
  const { canvas, statusEl } = requireEditorDom();

  // Initialize Asset System V2
  try {
    statusEl.textContent = 'Loading assets...';
    await initializeAssetLibrary(assetRegistry);
    Logger.info('Asset System V2 initialized successfully');
  } catch (error) {
    Logger.error('Failed to initialize Asset System:', error as Error);
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
