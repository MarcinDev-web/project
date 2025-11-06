import { Component } from './Component.js';
import { registerComponent } from './registry.js';

/**
 * UICanvasComponent - Main UI container component
 * Each entity with this component represents a UI canvas overlay
 */
export class UICanvasComponent extends Component {
  static readonly type = 'UICanvas';

  /** Whether the canvas is enabled and visible */
  enabled: boolean = true;

  /** Z-index for layer ordering (higher = on top) */
  zIndex: number = 1000;

  /** Optional background color for the canvas */
  backgroundColor?: string;

  getType(): string {
    return UICanvasComponent.type;
  }

  clone(): UICanvasComponent {
    const copy = new UICanvasComponent();
    copy.enabled = this.enabled;
    copy.zIndex = this.zIndex;
    if (this.backgroundColor !== undefined) copy.backgroundColor = this.backgroundColor;
    return copy;
  }

  toJSON(): {
    enabled: boolean;
    zIndex: number;
    backgroundColor?: string;
  } {
    return {
      enabled: this.enabled,
      zIndex: this.zIndex,
      ...(this.backgroundColor !== undefined && { backgroundColor: this.backgroundColor }),
    };
  }

  fromJSON(data: { enabled?: boolean; zIndex?: number; backgroundColor?: string }): void {
    if (typeof data.enabled === 'boolean') {
      this.enabled = data.enabled;
    }
    if (typeof data.zIndex === 'number') {
      this.zIndex = data.zIndex;
    }
    if (typeof data.backgroundColor === 'string') {
      this.backgroundColor = data.backgroundColor;
    }
  }
}

registerComponent(UICanvasComponent.type, UICanvasComponent);
