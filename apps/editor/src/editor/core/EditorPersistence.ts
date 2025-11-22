import type { OrbitControls } from '@engine/camera';
import { storageLoad, storageSave } from '../../utils/storage';
import type { EditorState } from './state';

export function restoreCamera(controls: OrbitControls): void {
  // Using 'camera_v2' to invalidate old low-angle camera state
  const cam = storageLoad<{ yaw: number; pitch: number; distance: number }>('camera_v2');
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
  storageSave('camera_v2', { yaw, pitch, distance });
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

export function persistCameraType(state: EditorState): void {
  try {
    storageSave('cameraType', state.cameraType.value);
  } catch {}
}

export function restoreCameraType(state: EditorState): void {
  try {
    const restored = storageLoad<'free-fly' | 'fps' | 'third-person'>('cameraType');
    // Only restore valid editor camera types (free-fly)
    // Ignore fps and third-person (not available in editor)
    if (restored === 'free-fly') {
      state.cameraType.value = restored;
    }
    // If stored value is fps or third-person, ignore it (default to free-fly)
  } catch {}
}

