import { effect } from '@preact/signals-core';
import type { EditorState } from '../core/state';
import { createIcon } from '../utils/icons';

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

    // Move
    const moveBtn = this.createButton('move', 'Move (W)', 'translate');
    this.container.appendChild(moveBtn);

    // Rotate
    const rotateBtn = this.createButton('rotate', 'Rotate (E)', 'rotate');
    this.container.appendChild(rotateBtn);

    // Scale
    const scaleBtn = this.createButton('scale', 'Scale (R)', 'scale');
    this.container.appendChild(scaleBtn);

    parent.appendChild(this.container);
  }

  private createButton(icon: string, title: string, mode: 'translate' | 'rotate' | 'scale'): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'floating-toolbar-btn';
    btn.title = title;
    
    // Icon
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

  public dispose(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

