import type {
  AxisKey,
  PlaneKey,
  HandleKey,
  AxisVisual,
  PlaneVisual,
  CenterVisual,
  GizmoConfig,
} from './GizmoTypes';
import { GIZMO_COLORS, DEFAULT_GIZMO_CONFIG } from './GizmoTypes';

/**
 * Handles all DOM manipulation and visual rendering for the gizmo.
 * Separated from controller logic for better organization.
 */
export class GizmoRenderer {
  private container: HTMLElement | null = null;
  private valueDisplay: HTMLElement | null = null;
  private valueDisplayTimeout: number | null = null;
  
  readonly axisVisuals: Record<AxisKey, AxisVisual>;
  readonly planeVisuals: Record<PlaneKey, PlaneVisual>;
  readonly centerVisual: CenterVisual;
  
  private hoveredHandle: HandleKey | null = null;
  private activeHandle: HandleKey | null = null;
  
  constructor(private readonly config: GizmoConfig = DEFAULT_GIZMO_CONFIG) {
    // Initialize axis visuals
    this.axisVisuals = {
      x: this.createAxisVisual([1, 0, 0], 'x'),
      y: this.createAxisVisual([0, 1, 0], 'y'),
      z: this.createAxisVisual([0, 0, 1], 'z'),
    };
    
    // Initialize plane visuals
    this.planeVisuals = {
      xy: this.createPlaneVisual('xy', ['x', 'y']),
      xz: this.createPlaneVisual('xz', ['x', 'z']),
      yz: this.createPlaneVisual('yz', ['y', 'z']),
    };
    
    // Initialize center visual
    this.centerVisual = this.createCenterVisual();
  }
  
  private createAxisVisual(worldDir: [number, number, number], axis: AxisKey): AxisVisual {
    const colors = GIZMO_COLORS[axis];
    
    const group = document.createElement('div');
    group.dataset.axis = axis;
    group.dataset.handle = axis;
    Object.assign(group.style, {
      position: 'absolute',
      pointerEvents: 'auto',
      transformOrigin: '0 50%',
      cursor: 'pointer',
      transition: `all ${this.config.transitionDuration}ms ease`,
    } as CSSStyleDeclaration);
    
    const line = document.createElement('div');
    Object.assign(line.style, {
      position: 'absolute',
      left: '0',
      top: `${-this.config.axisThickness / 2}px`,
      height: `${this.config.axisThickness}px`,
      borderRadius: `${this.config.axisThickness}px`,
      background: colors.base,
      pointerEvents: 'none',
      boxShadow: `0 0 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)`,
      transition: `all ${this.config.transitionDuration}ms ease`,
    } as CSSStyleDeclaration);
    
    const handle = document.createElement('div');
    Object.assign(handle.style, {
      position: 'absolute',
      width: `${this.config.handleSize}px`,
      height: `${this.config.handleSize}px`,
      top: `${-this.config.handleSize / 2}px`,
      borderRadius: '50%',
      background: colors.base,
      border: '2px solid rgba(0,0,0,0.5)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.4)',
      pointerEvents: 'none',
      transition: `all ${this.config.transitionDuration}ms ease`,
    } as CSSStyleDeclaration);
    
    group.appendChild(line);
    group.appendChild(handle);
    
    return {
      group,
      line,
      handle,
      color: colors.base,
      hoverColor: colors.hover,
      worldDir: [...worldDir],
      screenDir: [1, 0],
      screenLength: 0,
      opacity: 1,
    };
  }
  
  private createPlaneVisual(
    plane: PlaneKey,
    axes: [AxisKey, AxisKey]
  ): PlaneVisual {
    const colors = GIZMO_COLORS[plane];
    
    const group = document.createElement('div');
    group.dataset.plane = plane;
    group.dataset.handle = plane;
    Object.assign(group.style, {
      position: 'absolute',
      pointerEvents: 'auto',
      cursor: 'move',
      transition: `all ${this.config.transitionDuration}ms ease`,
    } as CSSStyleDeclaration);
    
    const square = document.createElement('div');
    Object.assign(square.style, {
      width: `${this.config.planeSize}px`,
      height: `${this.config.planeSize}px`,
      background: colors.base,
      border: '1px solid rgba(255,255,255,0.3)',
      pointerEvents: 'none',
      transition: `all ${this.config.transitionDuration}ms ease`,
    } as CSSStyleDeclaration);
    
    group.appendChild(square);
    
    const normal: [number, number, number] =
      plane === 'xy' ? [0, 0, 1] : plane === 'xz' ? [0, 1, 0] : [1, 0, 0];
    
    return {
      group,
      square,
      color: colors.base,
      hoverColor: colors.hover,
      axes,
      normal,
      screenPosition: null,
      visible: false,
    };
  }
  
  private createCenterVisual(): CenterVisual {
    const element = document.createElement('div');
    element.dataset.handle = 'center';
    Object.assign(element.style, {
      position: 'absolute',
      width: `${this.config.centerSize}px`,
      height: `${this.config.centerSize}px`,
      borderRadius: '50%',
      background: GIZMO_COLORS.center.base,
      border: '2px solid rgba(0,0,0,0.6)',
      boxShadow: '0 2px 6px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.5)',
      pointerEvents: 'auto',
      cursor: 'pointer',
      transition: `all ${this.config.transitionDuration}ms ease`,
      transform: 'translate(-50%, -50%)',
    } as CSSStyleDeclaration);
    
    return {
      element,
      screenPosition: null,
      visible: false,
    };
  }
  
  /**
   * Mount the gizmo to the DOM.
   */
  mount(): void {
    if (this.container) return;
    
    this.container = document.createElement('div');
    this.container.id = 'gizmo-container';
    Object.assign(this.container.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '17',
    });
    
    // Add all axis visuals
    Object.values(this.axisVisuals).forEach((axis) => {
      this.container!.appendChild(axis.group);
    });
    
    // Add all plane visuals
    Object.values(this.planeVisuals).forEach((plane) => {
      this.container!.appendChild(plane.group);
      plane.group.style.display = 'none';
    });
    
    // Add center visual
    this.container.appendChild(this.centerVisual.element);
    this.centerVisual.element.style.display = 'none';
    
    // Create value display overlay
    this.valueDisplay = document.createElement('div');
    this.valueDisplay.id = 'gizmo-value-display';
    Object.assign(this.valueDisplay.style, {
      position: 'absolute',
      padding: '6px 12px',
      background: 'rgba(0, 0, 0, 0.85)',
      color: '#fff',
      fontSize: '13px',
      fontFamily: 'monospace',
      borderRadius: '4px',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 150ms ease',
      zIndex: '18',
      whiteSpace: 'nowrap',
    });
    
    document.body.appendChild(this.container);
    document.body.appendChild(this.valueDisplay);
  }
  
  /**
   * Update axis visual positions and rotations.
   */
  updateAxisVisual(
    axis: AxisKey,
    originX: number,
    originY: number,
    targetX: number,
    targetY: number,
    opacity: number
  ): void {
    const visual = this.axisVisuals[axis];
    const dx = targetX - originX;
    const dy = targetY - originY;
    const length = Math.hypot(dx, dy);
    
    if (!Number.isFinite(length) || length < this.config.minAxisLength) {
      visual.group.style.display = 'none';
      visual.screenLength = 0;
      return;
    }
    
    visual.screenDir = [dx / length, dy / length];
    visual.screenLength = length;
    visual.opacity = opacity;
    
    visual.group.style.display = 'block';
    visual.group.style.left = `${originX}px`;
    visual.group.style.top = `${originY}px`;
    visual.group.style.transform = `translate(-1px, -1px) rotate(${Math.atan2(dy, dx)}rad)`;
    visual.group.style.opacity = `${opacity}`;
    
    visual.line.style.width = `${length}px`;
    visual.handle.style.left = `${length - this.config.handleSize / 2}px`;
  }
  
  /**
   * Update plane visual position.
   */
  updatePlaneVisual(
    plane: PlaneKey,
    screenX: number,
    screenY: number,
    visible: boolean
  ): void {
    const visual = this.planeVisuals[plane];
    visual.screenPosition = [screenX, screenY];
    visual.visible = visible;
    
    if (!visible) {
      visual.group.style.display = 'none';
      return;
    }
    
    visual.group.style.display = 'block';
    visual.group.style.left = `${screenX}px`;
    visual.group.style.top = `${screenY}px`;
  }
  
  /**
   * Update center visual position.
   */
  updateCenterVisual(screenX: number, screenY: number, visible: boolean): void {
    this.centerVisual.screenPosition = [screenX, screenY];
    this.centerVisual.visible = visible;
    
    if (!visible) {
      this.centerVisual.element.style.display = 'none';
      return;
    }
    
    this.centerVisual.element.style.display = 'block';
    this.centerVisual.element.style.left = `${screenX}px`;
    this.centerVisual.element.style.top = `${screenY}px`;
  }
  
  /**
   * Set hovered handle and update visual states.
   */
  setHoveredHandle(handle: HandleKey | null): void {
    if (this.hoveredHandle === handle) return;
    
    // Reset previous hover
    if (this.hoveredHandle && !this.activeHandle) {
      this.resetHandleStyle(this.hoveredHandle);
    }
    
    this.hoveredHandle = handle;
    
    // Apply hover style
    if (handle && !this.activeHandle) {
      this.applyHoverStyle(handle);
    }
  }
  
  /**
   * Set active handle (during drag).
   */
  setActiveHandle(handle: HandleKey | null): void {
    // Reset previous active
    if (this.activeHandle) {
      this.resetHandleStyle(this.activeHandle);
    }
    
    this.activeHandle = handle;
    
    // Apply active style
    if (handle) {
      this.applyActiveStyle(handle);
    }
  }
  
  private applyHoverStyle(handle: HandleKey): void {
    if (handle === 'x' || handle === 'y' || handle === 'z') {
      const visual = this.axisVisuals[handle];
      const scale = this.config.hoverScaleFactor;
      visual.line.style.background = visual.hoverColor;
      visual.handle.style.background = visual.hoverColor;
      visual.handle.style.transform = `scale(${scale})`;
      visual.group.style.cursor = 'grab';
    } else if (handle === 'xy' || handle === 'xz' || handle === 'yz') {
      const visual = this.planeVisuals[handle];
      visual.square.style.background = visual.hoverColor;
      visual.group.style.cursor = 'grab';
    } else if (handle === 'center') {
      this.centerVisual.element.style.background = GIZMO_COLORS.center.hover;
      this.centerVisual.element.style.transform = `translate(-50%, -50%) scale(${this.config.hoverScaleFactor})`;
      this.centerVisual.element.style.cursor = 'grab';
    }
  }
  
  private applyActiveStyle(handle: HandleKey): void {
    if (handle === 'x' || handle === 'y' || handle === 'z') {
      const visual = this.axisVisuals[handle];
      const colors = GIZMO_COLORS[handle];
      visual.line.style.background = colors.active;
      visual.handle.style.background = colors.active;
      visual.handle.style.boxShadow = '0 4px 12px rgba(0,0,0,0.6)';
      visual.group.style.cursor = 'grabbing';
    } else if (handle === 'xy' || handle === 'xz' || handle === 'yz') {
      const visual = this.planeVisuals[handle];
      visual.square.style.opacity = '0.8';
      visual.group.style.cursor = 'grabbing';
    } else if (handle === 'center') {
      this.centerVisual.element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.7)';
      this.centerVisual.element.style.cursor = 'grabbing';
    }
  }
  
  private resetHandleStyle(handle: HandleKey): void {
    if (handle === 'x' || handle === 'y' || handle === 'z') {
      const visual = this.axisVisuals[handle];
      visual.line.style.background = visual.color;
      visual.handle.style.background = visual.color;
      visual.handle.style.transform = 'scale(1)';
      visual.handle.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.4)';
      visual.group.style.cursor = 'pointer';
    } else if (handle === 'xy' || handle === 'xz' || handle === 'yz') {
      const visual = this.planeVisuals[handle];
      visual.square.style.background = visual.color;
      visual.square.style.opacity = '1';
      visual.group.style.cursor = 'move';
    } else if (handle === 'center') {
      this.centerVisual.element.style.background = GIZMO_COLORS.center.base;
      this.centerVisual.element.style.transform = 'translate(-50%, -50%) scale(1)';
      this.centerVisual.element.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.5)';
      this.centerVisual.element.style.cursor = 'pointer';
    }
  }
  
  /**
   * Show value display with text.
   */
  showValueDisplay(text: string, x: number, y: number): void {
    if (!this.valueDisplay) return;
    
    this.valueDisplay.textContent = text;
    this.valueDisplay.style.left = `${x + 20}px`;
    this.valueDisplay.style.top = `${y - 10}px`;
    this.valueDisplay.style.opacity = '1';
    
    // Clear existing timeout
    if (this.valueDisplayTimeout !== null) {
      clearTimeout(this.valueDisplayTimeout);
    }
  }
  
  /**
   * Hide value display with fade.
   */
  hideValueDisplay(delay: number = 500): void {
    if (!this.valueDisplay) return;
    
    if (this.valueDisplayTimeout !== null) {
      clearTimeout(this.valueDisplayTimeout);
    }
    
    this.valueDisplayTimeout = window.setTimeout(() => {
      if (this.valueDisplay) {
        this.valueDisplay.style.opacity = '0';
      }
      this.valueDisplayTimeout = null;
    }, delay);
  }
  
  /**
   * Set container visibility.
   */
  setVisible(visible: boolean): void {
    if (this.container) {
      this.container.style.display = visible ? 'block' : 'none';
    }
  }
  
  /**
   * Get handle at screen position (hit testing).
   */
  getHandleAtPosition(clientX: number, clientY: number): HandleKey | null {
    // Check center first (highest priority)
    if (this.centerVisual.visible && this.centerVisual.screenPosition) {
      const [cx, cy] = this.centerVisual.screenPosition;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const radius = this.config.centerSize / 2 + 5; // +5px padding
      if (dx * dx + dy * dy <= radius * radius) {
        return 'center';
      }
    }
    
    // Check plane handles
    for (const [key, visual] of Object.entries(this.planeVisuals) as [PlaneKey, PlaneVisual][]) {
      if (visual.visible && visual.screenPosition) {
        const [px, py] = visual.screenPosition;
        if (
          clientX >= px &&
          clientX <= px + this.config.planeSize &&
          clientY >= py &&
          clientY <= py + this.config.planeSize
        ) {
          return key;
        }
      }
    }
    
    // Check axis handles
    for (const [key, visual] of Object.entries(this.axisVisuals) as [AxisKey, AxisVisual][]) {
      if (visual.screenLength > 0) {
        const rect = visual.group.getBoundingClientRect();
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          return key;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Cleanup and remove from DOM.
   */
  dispose(): void {
    if (this.valueDisplayTimeout !== null) {
      clearTimeout(this.valueDisplayTimeout);
      this.valueDisplayTimeout = null;
    }
    
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    
    if (this.valueDisplay && this.valueDisplay.parentNode) {
      this.valueDisplay.parentNode.removeChild(this.valueDisplay);
    }
    this.valueDisplay = null;
    
    this.hoveredHandle = null;
    this.activeHandle = null;
  }
  
  getHoveredHandle(): HandleKey | null {
    return this.hoveredHandle;
  }
  
  getActiveHandle(): HandleKey | null {
    return this.activeHandle;
  }
}

