import type { OrbitControls } from '../../input';
import { storageLoad, storageSave } from '../../utils/storage';
import type { EditorState } from './state';

export function restoreCamera(controls: OrbitControls): void {
  const cam = storageLoad<{ yaw: number; pitch: number; distance: number }>('camera');
  if (
    cam &&
    Number.isFinite(cam.yaw) &&
    Number.isFinite(cam.pitch) &&
    Number.isFinite(cam.distance)
  ) {
    controls.setState({ yaw: cam.yaw, pitch: cam.pitch, distance: cam.distance });
  }
}

export function persistCamera(controls: OrbitControls): void {
  const { yaw, pitch, distance } = controls.getState();
  storageSave('camera', { yaw, pitch, distance });
}

export function persistLastPlacementPreset(state: EditorState): void {
  try {
    if (state.lastPlacementPreset.value) {
      storageSave('lastPlacementPreset', state.lastPlacementPreset.value);
    }
  } catch {}
}

export function restoreLastPlacementPreset(state: EditorState): void {
  try {
    const restored = storageLoad<{
      name: string;
      blockId?: string;
      scale: [number, number, number];
      color: [number, number, number, number];
    }>('lastPlacementPreset');
    if (restored) {
      state.lastPlacementPreset.value = restored;
    }
  } catch {}
}

export function persistUIPreferences(state: EditorState): void {
  try {
    storageSave('uiPreferences', state.uiPreferences.value);
  } catch {}
}

export function restoreUIPreferences(state: EditorState): void {
  try {
    const restored = storageLoad<typeof state.uiPreferences.value>('uiPreferences');
    if (restored) {
      state.uiPreferences.value = {
        ...state.uiPreferences.value,
        ...restored,
      };
    }
  } catch {}
}

export function persistWorkflowPreset(state: EditorState): void {
  try {
    storageSave('workflowPreset', state.workflowPreset.value);
  } catch {}
}

export function restoreWorkflowPreset(state: EditorState): void {
  try {
    const restored = storageLoad<typeof state.workflowPreset.value>('workflowPreset');
    if (restored) {
      state.workflowPreset.value = restored;
    }
  } catch {}
}
