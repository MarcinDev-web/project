/**
 * QuickAccessBar - Quick access to most frequently used properties
 * 
 * Features:
 * - Transform controls (Position, Rotation, Scale) in compact form
 * - Color picker in compact form
 * - Sticky positioning
 * - Collapsible
 */

import type { Entity } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { quatToEuler } from '@engine/core/math';
import type { RgbaColor } from '../../../utils/colors';
import { rgbaToHex } from '../../../utils/colors';
import { createIcon } from '../../utils/icons';
import { createVectorInput } from '../shared/VectorInput';
import { createColorPicker } from '../shared/ColorPicker';
import { MaterialComponent } from '@engine/world/components/MaterialComponent';

export interface QuickAccessBarConfig {
  entity: Entity;
  onTransformChanged: (entity: Entity) => void;
  onColorChanged: (entity: Entity, color: RgbaColor) => void;
  getSnapConfig: () => {
    enabled: boolean;
    increment: number;
    axes: { x: boolean; y: boolean; z: boolean };
    rotationIncrement: number;
    scaleIncrement: number;
    minScale: number;
  } | null;
  roundToIncrement: (value: number, increment: number) => number;
  entityHasTexture: (entity: Entity, materialComp: MaterialComponent | null) => boolean;
  abortSignal?: AbortSignal;
  setManagedTimeout?: (fn: () => void, delayMs: number) => number;
  registerUndo?: (action: () => void) => void;
  announce?: (message: string) => void;
  refresh?: () => void;
}

const MIN_SCALE = 0.001;

export class QuickAccessBar {
  private readonly root: HTMLElement;
  private isCollapsed = false;
  private transformContainer: HTMLElement | null = null;
  private colorContainer: HTMLElement | null = null;

  constructor(private readonly config: QuickAccessBarConfig) {
    this.root = document.createElement('div');
    this.root.className = 'quick-access-bar';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Quick Access Properties');

    this.render();
  }

  /**
   * Renders the quick access bar
   */
  private render(): void {
    this.root.innerHTML = '';

    // Header with collapse button
    const header = document.createElement('div');
    header.className = 'quick-access-header';

    const title = document.createElement('div');
    title.className = 'quick-access-title';
    title.appendChild(createIcon('sparkle', 16));
    const titleText = document.createElement('span');
    titleText.textContent = 'Quick Access';
    title.appendChild(titleText);
    header.appendChild(title);

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'quick-access-collapse';
    collapseBtn.setAttribute('aria-label', this.isCollapsed ? 'Expand Quick Access' : 'Collapse Quick Access');
    collapseBtn.setAttribute('aria-expanded', String(!this.isCollapsed));
    collapseBtn.appendChild(createIcon(this.isCollapsed ? 'chevron-down' : 'chevron-up', 14));
    collapseBtn.addEventListener('click', () => {
      this.toggleCollapse();
    }, { signal: this.config.abortSignal });
    header.appendChild(collapseBtn);

    this.root.appendChild(header);

    // Content container
    const content = document.createElement('div');
    content.className = 'quick-access-content';
    if (this.isCollapsed) {
      content.classList.add('collapsed');
    }

    // Transform section
    this.transformContainer = this.createTransformSection();
    content.appendChild(this.transformContainer);

    // Color section
    this.colorContainer = this.createColorSection();
    if (this.colorContainer) {
      content.appendChild(this.colorContainer);
    }

    this.root.appendChild(content);
  }

  /**
   * Creates compact transform controls
   */
  private createTransformSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'quick-access-section';

    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'quick-access-section-header';
    sectionHeader.appendChild(createIcon('move', 14));
    const headerText = document.createElement('span');
    headerText.textContent = 'Transform';
    sectionHeader.appendChild(headerText);
    section.appendChild(sectionHeader);

    const controls = document.createElement('div');
    controls.className = 'quick-access-controls';

    const entity = this.config.entity;

    // Position - compact
    const posContainer = document.createElement('div');
    posContainer.className = 'quick-access-control-group';
    posContainer.appendChild(
      createVectorInput({
        label: 'Position',
        values: entity.transform.position,
        onCommit: (next) => {
          const prev = [...entity.transform.position] as Vec3;
          const snap = this.config.getSnapConfig();
          if (snap) {
            const [x, y, z] = next;
            const xi = snap.axes.x ? this.config.roundToIncrement(x, snap.increment) : x;
            const yi = snap.axes.y ? this.config.roundToIncrement(y, snap.increment) : y;
            const zi = snap.axes.z ? this.config.roundToIncrement(z, snap.increment) : z;
            entity.transform.position = [xi, yi, zi];
          } else {
            entity.transform.position = next;
          }
          this.config.onTransformChanged(entity);
          this.config.registerUndo?.(() => {
            entity.transform.position = prev;
            this.config.onTransformChanged(entity);
          });
          this.config.announce?.('Position updated');
        },
        onReset: () => {
          const prev = [...entity.transform.position] as Vec3;
          entity.transform.position = [0, 0, 0];
          this.config.onTransformChanged(entity);
          this.config.refresh?.();
          this.config.registerUndo?.(() => {
            entity.transform.position = prev;
            this.config.onTransformChanged(entity);
          });
          this.config.announce?.('Position reset');
        },
        group: 'quick-position',
        abortSignal: this.config.abortSignal,
        debounceMs: 120,
        setManagedTimeout: this.config.setManagedTimeout,
      })
    );
    controls.appendChild(posContainer);

    // Rotation - compact
    const rotContainer = document.createElement('div');
    rotContainer.className = 'quick-access-control-group';
    rotContainer.appendChild(
      createVectorInput({
        label: 'Rotation (°)',
        values: (() => {
          const eulerRad = quatToEuler(entity.transform.rotation);
          const toDeg = (r: number) => (r * 180) / Math.PI;
          return [toDeg(eulerRad[0]), toDeg(eulerRad[1]), toDeg(eulerRad[2])] as Vec3;
        })(),
        onCommit: (nextDeg) => {
          const snap = this.config.getSnapConfig();
          const toRad = (d: number) => (d * Math.PI) / 180;
          const prevEulerRad = quatToEuler(entity.transform.rotation);
          let [dx, dy, dz] = nextDeg;
          if (snap) {
            const incDeg = (snap.rotationIncrement * 180) / Math.PI;
            dx = this.config.roundToIncrement(dx, incDeg);
            dy = this.config.roundToIncrement(dy, incDeg);
            dz = this.config.roundToIncrement(dz, incDeg);
          }
          entity.transform.setEulerAngles(toRad(dx), toRad(dy), toRad(dz));
          this.config.onTransformChanged(entity);
          this.config.registerUndo?.(() => {
            entity.transform.setEulerAngles(prevEulerRad[0], prevEulerRad[1], prevEulerRad[2]);
            this.config.onTransformChanged(entity);
          });
          this.config.announce?.('Rotation updated');
        },
        onReset: () => {
          const prevEulerRad = quatToEuler(entity.transform.rotation);
          entity.transform.setEulerAngles(0, 0, 0);
          this.config.onTransformChanged(entity);
          this.config.refresh?.();
          this.config.registerUndo?.(() => {
            entity.transform.setEulerAngles(prevEulerRad[0], prevEulerRad[1], prevEulerRad[2]);
            this.config.onTransformChanged(entity);
          });
          this.config.announce?.('Rotation reset');
        },
        group: 'quick-rotation',
        abortSignal: this.config.abortSignal,
        debounceMs: 120,
        setManagedTimeout: this.config.setManagedTimeout,
      })
    );
    controls.appendChild(rotContainer);

    // Scale - compact
    const scaleContainer = document.createElement('div');
    scaleContainer.className = 'quick-access-control-group';
    scaleContainer.appendChild(
      createVectorInput({
        label: 'Scale',
        values: entity.transform.scale,
        onCommit: (next) => {
          const prev = [...entity.transform.scale] as Vec3;
          const snap = this.config.getSnapConfig();
          const min = snap?.minScale ?? MIN_SCALE;
          let [sx, sy, sz] = next;
          if (snap) {
            sx = this.config.roundToIncrement(sx, snap.scaleIncrement);
            sy = this.config.roundToIncrement(sy, snap.scaleIncrement);
            sz = this.config.roundToIncrement(sz, snap.scaleIncrement);
          }
          entity.transform.scale = [
            Math.max(min, sx),
            Math.max(min, sy),
            Math.max(min, sz),
          ] as Vec3;
          this.config.onTransformChanged(entity);
          this.config.registerUndo?.(() => {
            entity.transform.scale = prev;
            this.config.onTransformChanged(entity);
          });
          this.config.announce?.('Scale updated');
        },
        onReset: () => {
          const prev = [...entity.transform.scale] as Vec3;
          entity.transform.scale = [1, 1, 1];
          this.config.onTransformChanged(entity);
          this.config.refresh?.();
          this.config.registerUndo?.(() => {
            entity.transform.scale = prev;
            this.config.onTransformChanged(entity);
          });
          this.config.announce?.('Scale reset');
        },
        group: 'quick-scale',
        abortSignal: this.config.abortSignal,
        debounceMs: 120,
        setManagedTimeout: this.config.setManagedTimeout,
      })
    );
    controls.appendChild(scaleContainer);

    section.appendChild(controls);
    return section;
  }

  /**
   * Creates compact color picker
   */
  private createColorSection(): HTMLElement | null {
    const entity = this.config.entity;
    const materialComp = entity.getComponent(MaterialComponent);
    const hasTexture = this.config.entityHasTexture(entity, materialComp);

    if (hasTexture) {
      // Don't show color picker for textured materials
      return null;
    }

    const section = document.createElement('div');
    section.className = 'quick-access-section';

    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'quick-access-section-header';
    sectionHeader.appendChild(createIcon('palette', 14));
    const headerText = document.createElement('span');
    headerText.textContent = 'Color';
    sectionHeader.appendChild(headerText);
    section.appendChild(sectionHeader);

    const controls = document.createElement('div');
    controls.className = 'quick-access-controls';

    controls.appendChild(
      createColorPicker({
        value: entity.color,
        onChange: (next) => this.config.onColorChanged(entity, next),
        abortSignal: this.config.abortSignal,
        setManagedTimeout: this.config.setManagedTimeout,
        dataFieldPrefix: 'quick-color',
      })
    );

    section.appendChild(controls);
    return section;
  }

  /**
   * Toggles collapse state
   */
  private toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    const content = this.root.querySelector('.quick-access-content');
    const collapseBtn = this.root.querySelector('.quick-access-collapse') as HTMLButtonElement;
    
    if (content) {
      content.classList.toggle('collapsed', this.isCollapsed);
    }
    
    if (collapseBtn) {
      collapseBtn.setAttribute('aria-expanded', String(!this.isCollapsed));
      collapseBtn.setAttribute('aria-label', this.isCollapsed ? 'Expand Quick Access' : 'Collapse Quick Access');
      collapseBtn.innerHTML = '';
      collapseBtn.appendChild(createIcon(this.isCollapsed ? 'chevron-down' : 'chevron-up', 14));
    }
  }

  /**
   * Updates the quick access bar with new entity values
   */
  updateEntity(entity: Entity): void {
    // Helper to check if value differs significantly (more than rounding error)
    const valuesDiffer = (inputValue: string, entityValue: number): boolean => {
      const parsed = Number.parseFloat(inputValue);
      if (!Number.isFinite(parsed)) return true;
      const diff = Math.abs(parsed - entityValue);
      return diff > 0.001; // More than rounding error
    };

    // Update transform values - update if no field is active, or if value differs (e.g., due to snap)
    const posX = this.root.querySelector('input[data-field="quick-position-x"]') as HTMLInputElement | null;
    const posY = this.root.querySelector('input[data-field="quick-position-y"]') as HTMLInputElement | null;
    const posZ = this.root.querySelector('input[data-field="quick-position-z"]') as HTMLInputElement | null;
    const isPositionActive = posX === document.activeElement || posY === document.activeElement || posZ === document.activeElement;
    
    if (posX) {
      const pos = entity.transform.position;
      const shouldUpdate = !isPositionActive || 
        valuesDiffer(posX.value, pos[0]) || 
        (posY && valuesDiffer(posY.value, pos[1])) || 
        (posZ && valuesDiffer(posZ.value, pos[2]));
      
      if (shouldUpdate) {
        posX.value = Number.isFinite(pos[0]) ? pos[0].toFixed(2) : '0.00';
        if (posY) posY.value = Number.isFinite(pos[1]) ? pos[1].toFixed(2) : '0.00';
        if (posZ) posZ.value = Number.isFinite(pos[2]) ? pos[2].toFixed(2) : '0.00';
      }
    }

    const rotX = this.root.querySelector('input[data-field="quick-rotation-x"]') as HTMLInputElement | null;
    const rotY = this.root.querySelector('input[data-field="quick-rotation-y"]') as HTMLInputElement | null;
    const rotZ = this.root.querySelector('input[data-field="quick-rotation-z"]') as HTMLInputElement | null;
    const isRotationActive = rotX === document.activeElement || rotY === document.activeElement || rotZ === document.activeElement;
    
    if (rotX) {
      const eulerRad = quatToEuler(entity.transform.rotation);
      const toDeg = (r: number) => (r * 180) / Math.PI;
      const degX = toDeg(eulerRad[0]);
      const degY = toDeg(eulerRad[1]);
      const degZ = toDeg(eulerRad[2]);
      
      const shouldUpdate = !isRotationActive || 
        valuesDiffer(rotX.value, degX) || 
        (rotY && valuesDiffer(rotY.value, degY)) || 
        (rotZ && valuesDiffer(rotZ.value, degZ));
      
      if (shouldUpdate) {
        rotX.value = Number.isFinite(eulerRad[0]) ? degX.toFixed(2) : '0.00';
        if (rotY) rotY.value = Number.isFinite(eulerRad[1]) ? degY.toFixed(2) : '0.00';
        if (rotZ) rotZ.value = Number.isFinite(eulerRad[2]) ? degZ.toFixed(2) : '0.00';
      }
    }

    const scaleX = this.root.querySelector('input[data-field="quick-scale-x"]') as HTMLInputElement | null;
    const scaleY = this.root.querySelector('input[data-field="quick-scale-y"]') as HTMLInputElement | null;
    const scaleZ = this.root.querySelector('input[data-field="quick-scale-z"]') as HTMLInputElement | null;
    const isScaleActive = scaleX === document.activeElement || scaleY === document.activeElement || scaleZ === document.activeElement;
    
    if (scaleX) {
      const scale = entity.transform.scale;
      const shouldUpdate = !isScaleActive || 
        valuesDiffer(scaleX.value, scale[0]) || 
        (scaleY && valuesDiffer(scaleY.value, scale[1])) || 
        (scaleZ && valuesDiffer(scaleZ.value, scale[2]));
      
      if (shouldUpdate) {
        scaleX.value = Number.isFinite(scale[0]) ? scale[0].toFixed(2) : '0.00';
        if (scaleY) scaleY.value = Number.isFinite(scale[1]) ? scale[1].toFixed(2) : '0.00';
        if (scaleZ) scaleZ.value = Number.isFinite(scale[2]) ? scale[2].toFixed(2) : '0.00';
      }
    }

    // Update color
    const colorInput = this.root.querySelector('input[data-field="quick-color"]') as HTMLInputElement | null;
    if (colorInput && document.activeElement !== colorInput) {
      const hex = rgbaToHex(entity.color).toUpperCase();
      colorInput.value = hex;
      const swatchInner = this.root.querySelector('[data-field="quick-color-swatch"]') as HTMLElement | null;
      if (swatchInner) swatchInner.style.background = hex;
      const display = this.root.querySelector('input[data-field="quick-color-display"]') as HTMLInputElement | null;
      if (display && document.activeElement !== display) {
        display.value = hex;
      }
    }
  }

  /**
   * Gets the root element
   */
  get element(): HTMLElement {
    return this.root;
  }

  /**
   * Disposes the component
   */
  dispose(): void {
    if (this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}

