import type { OrbitControls } from '@engine/camera';
import type { Scene } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import type { EditorState } from '../core/state';
import type { SnapSystem } from '@engine/editor-utils';
import type { PlacementMode } from '../placement/PlacementMode';
import type { ProjectManager } from '../managers/ProjectManager';
import type { Clipboard } from '../utils/Clipboard';
import type { Entity } from '@engine/world';
import type { BlockDragController } from './BlockDragController';
import { QuaternionHelper } from '../utils/QuaternionHelper';

export interface KeyboardHandlerOptions {
  state: EditorState;
  scene: Scene;
  selection: SelectionManager;
  controls: OrbitControls;
  statusEl: HTMLElement;
  snapSystem: SnapSystem | null;
  placementMode: PlacementMode | null;
  dragController: BlockDragController | null;
  projectManager: ProjectManager | null;
  updateSceneBuffers: () => void;
  updateGizmoOverlay: () => void;
  getClipboard: () => Clipboard | null;
  recordSnapshot: (description: string) => void;
  showLoadDialog: () => Promise<void>;
  openBlockEditor: () => void;
  exitPlayMode?: () => void;
}

interface Command {
  shortcut: string;
  canExecute: () => boolean;
  execute: () => void;
  preventDefault?: boolean;
}

export class KeyboardHandler {
  private onKeyDownRef: ((e: KeyboardEvent) => void) | null = null;
  private commands = new Map<string, Command>();

  constructor(private readonly options: KeyboardHandlerOptions) {}

  public initialize(): void {
    if (this.onKeyDownRef) return;
    this.registerDefaultCommands();
    this.onKeyDownRef = (event: KeyboardEvent) => this.handleKeyDown(event);
    window.addEventListener('keydown', this.onKeyDownRef);
  }

  public dispose(): void {
    if (this.onKeyDownRef) {
      window.removeEventListener('keydown', this.onKeyDownRef);
      this.onKeyDownRef = null;
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const combo = this.getKeyCombo(event);
    const command = this.commands.get(combo);
    if (command && command.canExecute()) {
      if (command.preventDefault) event.preventDefault();
      command.execute();
    }
  }

  public registerCommand(key: string, command: Command): void {
    this.commands.set(key, command);
  }

  public unregisterCommand(key: string): void {
    this.commands.delete(key);
  }

  public clearCommands(): void {
    this.commands.clear();
  }

  private getKeyCombo(event: KeyboardEvent): string {
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const ctrl = isMac ? event.metaKey : event.ctrlKey;
    const parts: string[] = [];
    if (ctrl) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    parts.push(event.key.toLowerCase());
    return parts.join('+');
  }

  private registerDefaultCommands(): void {
    const { state, controls, scene, selection, snapSystem, placementMode, projectManager } =
      this.options;

    this.registerCommand('ctrl+z', {
      shortcut: 'ctrl+z',
      preventDefault: true,
      canExecute: () => true,
      execute: () => {
        (document.activeElement as HTMLElement | null)?.blur?.();
        window.dispatchEvent(new CustomEvent('editor:undo'));
      },
    });

    this.registerCommand('ctrl+y', {
      shortcut: 'ctrl+y',
      preventDefault: true,
      canExecute: () => true,
      execute: () => window.dispatchEvent(new CustomEvent('editor:redo')),
    });

    this.registerCommand('ctrl+s', {
      shortcut: 'ctrl+s',
      preventDefault: true,
      canExecute: () => true,
      execute: () => void projectManager?.saveProject(),
    });

    this.registerCommand('ctrl+shift+s', {
      shortcut: 'ctrl+shift+s',
      preventDefault: true,
      canExecute: () => true,
      execute: () => void projectManager?.saveProjectAs(),
    });

    this.registerCommand('ctrl+o', {
      shortcut: 'ctrl+o',
      preventDefault: true,
      canExecute: () => true,
      execute: () => void this.options.showLoadDialog(),
    });

    this.registerCommand('ctrl+shift+b', {
      shortcut: 'ctrl+shift+b',
      preventDefault: true,
      canExecute: () => true,
      execute: () => this.options.openBlockEditor(),
    });

    this.registerCommand('ctrl+c', {
      shortcut: 'ctrl+c',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => {
        const entities = Array.from(selection.selectedEntities);
        this.options.getClipboard()?.copy(entities);
      },
    });

    this.registerCommand('ctrl+x', {
      shortcut: 'ctrl+x',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0 && state.editorMode.value !== 'play',
      execute: () => {
        const selected = Array.from(selection.selectedEntities);
        this.options.getClipboard()?.copy(selected);
        for (const entity of selected) {
          scene.removeEntity(entity);
        }
        this.options.updateSceneBuffers();
        selection.clearSelection();
        this.options.recordSnapshot('Cut entities');
      },
    });

    this.registerCommand('ctrl+v', {
      shortcut: 'ctrl+v',
      preventDefault: true,
      canExecute: () => !!this.options.getClipboard() && state.editorMode.value !== 'play',
      execute: () => {
        const clipboard = this.options.getClipboard();
        if (!clipboard) return;
        const pasted = clipboard.paste(scene);
        if (pasted.length > 0) {
          selection.selectMultiple(pasted, 'set');
          this.options.updateSceneBuffers();
          this.options.recordSnapshot('Paste');
        }
      },
    });

    this.registerCommand('ctrl+d', {
      shortcut: 'ctrl+d',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0 && state.editorMode.value !== 'play',
      execute: () => {
        const selected = Array.from(selection.selectedEntities);
        const clipboard = this.options.getClipboard();
        if (!clipboard) return;
        
        // Copy and paste
        clipboard.copy(selected);
        const duplicated = clipboard.paste(scene);
        
        if (duplicated.length > 0) {
          // Offset duplicated entities slightly
          for (const entity of duplicated) {
            entity.transform.position[0] += 0.5;
            entity.transform.position[2] += 0.5;
          }
          
          selection.selectMultiple(duplicated, 'set');
          this.options.updateSceneBuffers();
          this.options.recordSnapshot('Duplicate');
        }
      },
    });

    this.registerCommand('ctrl+a', {
      shortcut: 'ctrl+a',
      preventDefault: true,
      canExecute: () => true,
      execute: () => {
        const allEntities: Entity[] = [];
        scene.traverse((entity) => {
          allEntities.push(entity);
        });
        
        if (allEntities.length === 0) return;
        
        // Select first entity as primary, add rest to selection
        selection.selectMultiple(allEntities, 'set');
      },
    });

    this.registerCommand('delete', {
      shortcut: 'delete',
      canExecute: () => selection.selectedEntities.size > 0 && state.editorMode.value !== 'play',
      execute: () => {
        const selected = Array.from(selection.selectedEntities);
        for (const entity of selected) {
          // Remove from scene regardless of parent
          scene.removeEntity(entity);
        }
        this.options.updateSceneBuffers();
        selection.clearSelection();
        this.options.recordSnapshot('Delete entities');
      },
    });

    this.registerCommand('w', {
      shortcut: 'w',
      canExecute: () => !placementMode?.isActive() && state.cameraMode.value !== 'free-fly',
      execute: () => {
        state.gizmoMode.value = 'translate';
      },
    });

    this.registerCommand('e', {
      shortcut: 'e',
      canExecute: () => state.cameraMode.value !== 'free-fly',
      execute: async () => {
        if (placementMode?.isActive()) {
          await placementMode.rotatePreview(1);
          this.options.statusEl.textContent = 'Rotated CW';
          setTimeout(() => (this.options.statusEl.textContent = ''), 500);
        } else {
          state.gizmoMode.value = 'rotate';
        }
      },
    });

    this.registerCommand('r', {
      shortcut: 'r',
      canExecute: () => !placementMode?.isActive() && state.cameraMode.value !== 'free-fly',
      execute: () => {
        state.gizmoMode.value = 'scale';
      },
    });

    this.registerCommand('shift+r', {
      shortcut: 'shift+r',
      preventDefault: true,
      canExecute: () => !placementMode?.isActive(),
      execute: () => {
        state.gizmoMode.value = 'uniform';
        this.options.statusEl.textContent = 'Gizmo: Uniform Scale';
        setTimeout(() => (this.options.statusEl.textContent = ''), 1000);
      },
    });

    this.registerCommand('f', {
      shortcut: 'f',
      canExecute: () => !!selection.primarySelection,
      execute: () => {
        const { distance } = controls.getState();
        controls.setState({ yaw: 0, pitch: 0, distance });
        requestAnimationFrame(() => this.options.updateGizmoOverlay());
      },
    });

    this.registerCommand('x', {
      shortcut: 'x',
      preventDefault: true,
      canExecute: () => !!snapSystem,
      execute: () => {
        snapSystem?.toggle();
        this.options.statusEl.textContent = `Snap: ${snapSystem?.isEnabled() ? 'ON' : 'OFF'}`;
        setTimeout(() => {
          this.options.statusEl.textContent = '';
        }, 1000);
        if (snapSystem) {
          this.options.state.snapConfig.value = {
            ...this.options.state.snapConfig.value,
            enabled: snapSystem.isEnabled(),
          };
        }
      },
    });

    this.registerCommand('[', {
      shortcut: '[',
      preventDefault: true,
      canExecute: () => true,
      execute: () => {
        const current = state.snapConfig.value.increment;
        const newIncrement = Math.max(0.25, current / 2);
        state.snapConfig.value = { ...state.snapConfig.value, increment: newIncrement };
        state.gridConfig.value = { ...state.gridConfig.value, cellSize: newIncrement };
        this.options.statusEl.textContent = `Grid: ${newIncrement}`;
        setTimeout(() => (this.options.statusEl.textContent = ''), 1000);
      },
    });

    this.registerCommand(']', {
      shortcut: ']',
      preventDefault: true,
      canExecute: () => true,
      execute: () => {
        const current = state.snapConfig.value.increment;
        const newIncrement = Math.min(10, current * 2);
        state.snapConfig.value = { ...state.snapConfig.value, increment: newIncrement };
        state.gridConfig.value = { ...state.gridConfig.value, cellSize: newIncrement };
        this.options.statusEl.textContent = `Grid: ${newIncrement}`;
        setTimeout(() => (this.options.statusEl.textContent = ''), 1000);
      },
    });

    this.registerCommand('g', {
      shortcut: 'g',
      preventDefault: true,
      canExecute: () => !placementMode?.isActive(),
      execute: () => {
        state.showGrid.value = !state.showGrid.value;
        this.options.statusEl.textContent = `Grid: ${state.showGrid.value ? 'ON' : 'OFF'}`;
        setTimeout(() => (this.options.statusEl.textContent = ''), 1000);
      },
    });

    this.registerCommand('q', {
      shortcut: 'q',
      preventDefault: true,
      canExecute: () => !!placementMode?.isActive() && state.cameraMode.value !== 'free-fly',
      execute: async () => {
        await placementMode?.rotatePreview(-1);
        this.options.statusEl.textContent = 'Rotated CCW';
        setTimeout(() => (this.options.statusEl.textContent = ''), 500);
      },
    });

    this.registerCommand('enter', {
      shortcut: 'enter',
      preventDefault: true,
      canExecute: () => !!placementMode?.isActive(),
      execute: () => {
        const placed = placementMode?.confirmPlacement();
        if (placed) {
          selection.select(placed);
          this.options.updateSceneBuffers();
          state.placementMode.value = false;
          this.options.recordSnapshot('Place object');
          this.options.statusEl.textContent = 'Object placed!';
          setTimeout(() => (this.options.statusEl.textContent = ''), 1000);
        } else {
          this.options.statusEl.textContent = 'Cannot place here (collision)';
          setTimeout(() => (this.options.statusEl.textContent = ''), 1000);
        }
      },
    });

    this.registerCommand('escape', {
      shortcut: 'escape',
      canExecute: () => true,
      preventDefault: true,
      execute: () => {
        if (state.editorMode.value === 'play') {
          this.options.exitPlayMode?.();
          return;
        }
        if (placementMode?.isActive()) {
          placementMode.cancelPlacement();
          this.options.statusEl.textContent = '';
          return;
        }
        selection.clearSelection();
      },
    });

    // Easy Place: Toggle Easy Place mode
    this.registerCommand('p', {
      shortcut: 'p',
      preventDefault: true,
      canExecute: () => true,
      execute: () => {
        state.easyPlaceMode.value = !state.easyPlaceMode.value;
        this.options.statusEl.textContent = `Easy Place: ${state.easyPlaceMode.value ? 'ON' : 'OFF'}`;
        setTimeout(() => (this.options.statusEl.textContent = ''), 1000);
      },
    });

    // Camera: V key removed - free-fly is now the default editor camera

    // Easy Place: Switch to line pattern
    this.registerCommand('l', {
      shortcut: 'l',
      preventDefault: true,
      canExecute: () => state.easyPlaceMode.value && !!placementMode?.isActive(),
      execute: () => {
        state.easyPlacePattern.value = 'line';
        this.options.statusEl.textContent = 'Pattern: Line';
        setTimeout(() => (this.options.statusEl.textContent = ''), 1000);
      },
    });

    // Easy Place: Switch to grid pattern
    this.registerCommand('shift+g', {
      shortcut: 'shift+g',
      preventDefault: true,
      canExecute: () => state.easyPlaceMode.value && !!placementMode?.isActive(),
      execute: () => {
        state.easyPlacePattern.value = 'grid';
        this.options.statusEl.textContent = 'Pattern: Grid';
        setTimeout(() => (this.options.statusEl.textContent = ''), 1000);
      },
    });

    // Easy Place: Switch to circle pattern
    this.registerCommand('c', {
      shortcut: 'c',
      preventDefault: true,
      canExecute: () => state.easyPlaceMode.value && !!placementMode?.isActive(),
      execute: () => {
        state.easyPlacePattern.value = 'circle';
        this.options.statusEl.textContent = 'Pattern: Circle';
        setTimeout(() => (this.options.statusEl.textContent = ''), 1000);
      },
    });

    // Precision: Arrow key movement
    const moveEntity = (axis: 'x' | 'y' | 'z', direction: number, step: number) => {
      if (selection.selectedEntities.size === 0) return;
      
      for (const entity of selection.selectedEntities) {
        const pos = [...entity.transform.position] as [number, number, number];
        const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
        pos[axisIndex] += direction * step;
        entity.transform.position = pos;
      }
      
      this.options.updateSceneBuffers();
      this.options.recordSnapshot('Move entity');
    };

    // Arrow Right: Move +X
    this.registerCommand('arrowright', {
      shortcut: 'arrowright',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('x', 1, state.precisionSettings.value.positionStep),
    });

    this.registerCommand('shift+arrowright', {
      shortcut: 'shift+arrowright',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('x', 1, state.precisionSettings.value.fineStep),
    });

    this.registerCommand('ctrl+arrowright', {
      shortcut: 'ctrl+arrowright',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('x', 1, state.precisionSettings.value.coarseStep),
    });

    // Arrow Left: Move -X
    this.registerCommand('arrowleft', {
      shortcut: 'arrowleft',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('x', -1, state.precisionSettings.value.positionStep),
    });

    this.registerCommand('shift+arrowleft', {
      shortcut: 'shift+arrowleft',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('x', -1, state.precisionSettings.value.fineStep),
    });

    this.registerCommand('ctrl+arrowleft', {
      shortcut: 'ctrl+arrowleft',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('x', -1, state.precisionSettings.value.coarseStep),
    });

    // Arrow Up: Move +Z (forward)
    this.registerCommand('arrowup', {
      shortcut: 'arrowup',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('z', -1, state.precisionSettings.value.positionStep),
    });

    this.registerCommand('shift+arrowup', {
      shortcut: 'shift+arrowup',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('z', -1, state.precisionSettings.value.fineStep),
    });

    this.registerCommand('ctrl+arrowup', {
      shortcut: 'ctrl+arrowup',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('z', -1, state.precisionSettings.value.coarseStep),
    });

    // Arrow Down: Move -Z (backward)
    this.registerCommand('arrowdown', {
      shortcut: 'arrowdown',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('z', 1, state.precisionSettings.value.positionStep),
    });

    this.registerCommand('shift+arrowdown', {
      shortcut: 'shift+arrowdown',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('z', 1, state.precisionSettings.value.fineStep),
    });

    this.registerCommand('ctrl+arrowdown', {
      shortcut: 'ctrl+arrowdown',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('z', 1, state.precisionSettings.value.coarseStep),
    });

    // Page Up/Down: Move Y axis
    this.registerCommand('pageup', {
      shortcut: 'pageup',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('y', 1, state.precisionSettings.value.positionStep),
    });

    this.registerCommand('shift+pageup', {
      shortcut: 'shift+pageup',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('y', 1, state.precisionSettings.value.fineStep),
    });

    this.registerCommand('pagedown', {
      shortcut: 'pagedown',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('y', -1, state.precisionSettings.value.positionStep),
    });

    this.registerCommand('shift+pagedown', {
      shortcut: 'shift+pagedown',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => moveEntity('y', -1, state.precisionSettings.value.fineStep),
    });

    // Precision: Bracket key rotation
    const rotateEntity = (axis: 'x' | 'y' | 'z', degrees: number) => {
      if (selection.selectedEntities.size === 0) return;
      
      for (const entity of selection.selectedEntities) {
        let newRot;
        switch (axis) {
          case 'x':
            newRot = QuaternionHelper.rotateX(entity.transform.rotation, degrees);
            break;
          case 'y':
            newRot = QuaternionHelper.rotateY(entity.transform.rotation, degrees);
            break;
          case 'z':
            newRot = QuaternionHelper.rotateZ(entity.transform.rotation, degrees);
            break;
        }
        entity.transform.rotation = newRot;
      }
      
      this.options.updateSceneBuffers();
      this.options.recordSnapshot('Rotate entity');
    };

    // [ key: Rotate X -5°
    this.registerCommand('[', {
      shortcut: '[',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => rotateEntity('x', -state.precisionSettings.value.rotationStep),
    });

    this.registerCommand('shift+[', {
      shortcut: 'shift+[',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => rotateEntity('x', -state.precisionSettings.value.fineRotationStep),
    });

    // ] key: Rotate X +5°
    this.registerCommand(']', {
      shortcut: ']',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => rotateEntity('x', state.precisionSettings.value.rotationStep),
    });

    this.registerCommand('shift+]', {
      shortcut: 'shift+]',
      preventDefault: true,
      canExecute: () => selection.selectedEntities.size > 0,
      execute: () => rotateEntity('x', state.precisionSettings.value.fineRotationStep),
    });
  }
}
