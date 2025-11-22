import { effect } from '@preact/signals-core';
import type { EditorState } from '../../core/state';
import { createIcon } from '../../utils/icons';
import type { PlacementToolType } from '../../placement/PlacementMode';

export interface FloatingToolbarConfig {
  state: EditorState;
  onGizmoModeChange: (mode: 'translate' | 'rotate' | 'scale') => void;
}

export class FloatingToolbar {
  private container: HTMLElement | null = null;

  constructor(private readonly config: FloatingToolbarConfig) {}

  public mount(parent: HTMLElement): void {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.className = 'floating-toolbar';

    // Gizmo Controls Container
    const gizmoContainer = document.createElement('div');
    gizmoContainer.className = 'toolbar-group';
    gizmoContainer.style.display = 'flex';
    gizmoContainer.style.alignItems = 'center';
    
    // Placement Controls Container
    const placementContainer = document.createElement('div');
    placementContainer.className = 'toolbar-group';
    placementContainer.style.display = 'none';
    placementContainer.style.alignItems = 'center';

    this.container.appendChild(gizmoContainer);
    this.container.appendChild(placementContainer);

    // --- Gizmo Tools ---
    const moveBtn = this.createButton('move', 'Move (W)', 'translate');
    gizmoContainer.appendChild(moveBtn);

    const rotateBtn = this.createButton('rotate', 'Rotate (E)', 'rotate');
    gizmoContainer.appendChild(rotateBtn);

    const scaleBtn = this.createButton('scale', 'Scale (R)', 'scale');
    gizmoContainer.appendChild(scaleBtn);

    // --- Placement Tools ---
    const singleBtn = this.createPlacementButton('cube', 'Single Block', 'single');
    placementContainer.appendChild(singleBtn);

    const lineBtn = this.createPlacementButton('minus', 'Line Mode', 'line');
    placementContainer.appendChild(lineBtn);

    const boxBtn = this.createPlacementButton('box', 'Box/Plane Mode', 'box');
    placementContainer.appendChild(boxBtn);

    const paintBtn = this.createPlacementButton('palette', 'Paint Mode', 'paint');
    placementContainer.appendChild(paintBtn);

    const symmetryBtn = this.createPlacementButton('copy', 'Symmetry Mode', 'symmetry');
    placementContainer.appendChild(symmetryBtn);

    // --- Common Controls (Snap) ---
    const separator = document.createElement('div');
    separator.style.width = '1px';
    separator.style.height = '20px';
    separator.style.background = 'var(--color-border)';
    separator.style.margin = '0 4px';
    this.container.appendChild(separator);

    // Grid Snap
    const gridSnapBtn = this.createToggle('grid', 'Grid Snap', 
      () => this.config.state.snapConfig.value.enabled,
      () => {
        const current = this.config.state.snapConfig.value;
        this.config.state.snapConfig.value = { ...current, enabled: !current.enabled };
      }
    );
    this.container.appendChild(gridSnapBtn);

    // Rotation Snap
    const rotSnapBtn = this.createToggle('rotate-ccw', 'Rotation Snap (Click to cycle)',
      () => this.config.state.rotationSnapMode.value !== 'free',
      () => {
        const modes = ['free', '15deg', '45deg', '90deg'] as const;
        const current = this.config.state.rotationSnapMode.value;
        const idx = modes.indexOf(current as any);
        const next = modes[(idx + 1) % modes.length];
        this.config.state.rotationSnapMode.value = next;
      },
      () => {
        const mode = this.config.state.rotationSnapMode.value;
        rotSnapBtn.title = `Rotation Snap: ${mode}`;
      }
    );
    this.container.appendChild(rotSnapBtn);

    parent.appendChild(this.container);

    // Toggle visibility based on mode
    effect(() => {
        const isPlacement = this.config.state.placementMode.value;
        gizmoContainer.style.display = isPlacement ? 'none' : 'flex';
        placementContainer.style.display = isPlacement ? 'flex' : 'none';
    });
  }

  private createToggle(
    icon: string, 
    title: string, 
    getState: () => boolean, 
    onClick: () => void,
    onUpdate?: () => void
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'floating-toolbar-btn';
    btn.title = title;
    
    const iconEl = createIcon(icon as any, 18);
    btn.appendChild(iconEl);

    btn.addEventListener('click', onClick);

    effect(() => {
      const active = getState();
      btn.classList.toggle('active', active);
      onUpdate?.();
    });

    return btn;
  }

  private createButton(icon: string, title: string, mode: 'translate' | 'rotate' | 'scale'): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'floating-toolbar-btn';
    btn.title = title;
    
    const iconEl = createIcon(icon as any, 18);
    btn.appendChild(iconEl);

    btn.addEventListener('click', () => {
      this.config.onGizmoModeChange(mode);
    });

    // React to state
    effect(() => {
      const active = this.config.state.gizmoMode.value === mode;
      btn.classList.toggle('active', active);
    });

    return btn;
  }

  private createPlacementButton(icon: string, title: string, tool: PlacementToolType): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'floating-toolbar-btn';
    btn.title = title;
    
    const iconEl = createIcon(icon as any, 18);
    btn.appendChild(iconEl);

    btn.addEventListener('click', () => {
      this.config.state.activePlacementTool.value = tool;
    });

    // React to state
    effect(() => {
      const active = this.config.state.activePlacementTool.value === tool;
      btn.classList.toggle('active', active);
    });

    return btn;
  }

  public dispose(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
