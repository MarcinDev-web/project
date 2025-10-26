/**
 * PropertiesPanel - Modern Property Inspector (REDESIGNED)
 *
 * Features:
 * - Collapsible property sections with animation
 * - Component badges and visual indicators
 * - Enhanced number inputs with drag-to-edit
 * - Copy/paste and reset buttons
 * - Modern toggle switches
 * - Beautiful color picker
 * - Real-time updates
 * - Professional glassmorphic design
 * - Compact and organized layout
 */

import type { Entity } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { quatToEuler } from '@engine/core/math';
import type { SelectionManager } from '@engine/world';
import { rgbaToHex, type RgbaColor } from '../../utils/colors';
import type { EditorState, InspectorLayoutPreferences } from '../core/state';
import { DEFAULT_INSPECTOR_SECTION_ORDER } from '../core/state';
import { createIcon } from '../utils/icons';
import type { IconName } from '../utils/icons';
import { CameraComponent } from '@engine/world/components/CameraComponent';
import { EnvironmentComponent } from '@engine/world/components/EnvironmentComponent';
import { createVectorInput } from '../ui/VectorInput';
import { createColorPicker } from '../ui/ColorPicker';
import { ScriptComponent, type ScriptComponentState, type ScriptDefinition } from '@engine/world/components/ScriptComponent';
import { CoordinateManager } from '../utils/CoordinateManager';
import { QuaternionHelper } from '../utils/QuaternionHelper';
import { BehaviorRegistry } from '@engine/script';
import { AnimationComponent } from '@engine/world/components/AnimationComponent';
import { createAnimationSection } from '../ui/animation/AnimationSection';
import { MaterialComponent } from '@engine/world/components/MaterialComponent';

const MIN_SCALE = 0.001;

interface PropertiesPanelConfig {
  selection: SelectionManager;
  onTransformChanged: (entity: Entity) => void;
  onColorChanged: (entity: Entity, color: RgbaColor) => void;
  onEntityRenamed: (entity: Entity) => void;
  onOpenScriptWorkbench?: () => void;
  state?: EditorState;
}



interface SectionMeta {
  id: string;
  label: string;
  icon: IconName;
}

const SECTION_METADATA: SectionMeta[] = [
  { id: 'transform', label: 'Transform', icon: 'move' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'material', label: 'Material', icon: 'palette' },
  { id: 'camera', label: 'Camera', icon: 'camera' },
  { id: 'environment', label: 'Environment', icon: 'sun' },
  { id: 'animation', label: 'Animation', icon: 'play' },
  { id: 'scripts', label: 'Scripts', icon: 'list' },
];

export class PropertiesPanel {
  private readonly root: HTMLElement;
  private readonly content: HTMLElement;
  private refreshAbort: AbortController | null = null;
  private activeTimeouts = new Set<number>();
  private renderedEntityId: string | null = null;
  private debounceTimers = new WeakMap<EventTarget, number>();
  private fallbackInspectorLayout: InspectorLayoutPreferences = {
    order: [...DEFAULT_INSPECTOR_SECTION_ORDER],
    collapsed: {},
    activeSection: 'transform',
  };
  private sectionElements = new Map<string, HTMLElement>();
  private tabButtons = new Map<string, HTMLButtonElement>();
  private currentSectionOrder: string[] = [];
  private sectionTabs: HTMLElement | null = null;
  private scrollRaf: number | null = null;
  private handleRootKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      this.performUndo();
    }
  };
  private availableSections: string[] = [];
  private sectionsWrapper: HTMLElement | null = null;
  private draggingTabId: string | null = null;

  constructor(private readonly config: PropertiesPanelConfig) {
    this.root = document.createElement('section');
    this.root.className = 'inspector';
    this.root.setAttribute('data-tab', 'Properties');

    const header = document.createElement('div');
    header.className = 'inspector-header-v2';

    const titleRow = document.createElement('div');
    titleRow.className = 'inspector-header-row';

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'inspector-header-icon';
    iconWrapper.appendChild(createIcon('sliders', 20));

    const titleGroup = document.createElement('div');
    titleGroup.className = 'inspector-header-group';

    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.textContent = 'Inspector';

    const subtitle = document.createElement('p');
    subtitle.className = 'panel-subtitle';
    subtitle.textContent = 'Entity Properties';

    titleGroup.appendChild(title);
    titleGroup.appendChild(subtitle);

    titleRow.appendChild(iconWrapper);
    titleRow.appendChild(titleGroup);
    header.appendChild(titleRow);

    this.root.appendChild(header);

    this.content = document.createElement('div');
    this.content.className = 'inspector-content custom-scrollbar';
    this.content.addEventListener('scroll', this.handleScroll, { passive: true });
    this.root.appendChild(this.content);

    this.root.addEventListener('keydown', this.handleRootKeyDown);
  }

  public mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }

  public refresh(): void {
    const selected =
      this.config.state?.selectedEntity.value ?? this.config.selection.primarySelection;

    const layoutPrefs = this.getLayoutPrefs();
    this.currentSectionOrder = [...layoutPrefs.order];

    if (this.currentSectionOrder.length === 0) {
      this.currentSectionOrder = [...DEFAULT_INSPECTOR_SECTION_ORDER];
    }

    // Trigger on any reactive event revisions so effects can cause this to run
    if (this.config.state) {
      void this.config.state.transformRev.value;
      void this.config.state.colorRev.value;
      void this.config.state.renameRev.value;
    }

    if (!selected) {
      this.beginRefreshScope();
      this.content.innerHTML = '';

      const empty = document.createElement('div');
      empty.className = 'inspector-empty-v2';
      
      const emptyIcon = document.createElement('div');
      emptyIcon.className = 'inspector-empty-icon-v2';
      emptyIcon.appendChild(createIcon('package', 64));
      
      const emptyTitle = document.createElement('h3');
      emptyTitle.className = 'inspector-empty-title';
      emptyTitle.textContent = 'No Selection';
      
      const emptyText = document.createElement('p');
      emptyText.className = 'inspector-empty-text';
      emptyText.textContent = 'Select an entity to view and edit its properties';
      
      empty.appendChild(emptyIcon);
      empty.appendChild(emptyTitle);
      empty.appendChild(emptyText);
      
      this.content.appendChild(empty);
      this.renderedEntityId = null;
      this.restoreFocus();
      return;
    }

    if (this.renderedEntityId === selected.id && this.tryUpdateExistingValues(selected)) {
      // Incremental value update succeeded without rebuilding
      return;
    }

    // Full rebuild
    this.beginRefreshScope();
    this.content.innerHTML = '';
    this.sectionElements.clear();
    this.tabButtons.clear();
    this.renderedEntityId = selected.id;

    const layoutContainer = document.createElement('div');
    layoutContainer.className = 'inspector-layout';

    const sectionEntries = this.buildSections(selected);
    const tabs = this.renderTabs(sectionEntries.map((entry) => entry.id));
    layoutContainer.appendChild(tabs);

    const sectionsWrapper = document.createElement('div');
    sectionsWrapper.className = 'inspector-sections';
    this.sectionsWrapper = sectionsWrapper;
    layoutContainer.appendChild(sectionsWrapper);

    this.content.appendChild(layoutContainer);

    const entityCard = this.createEntityCard(selected);
    entityCard.classList.add('inspector-entity-card');
    this.sectionElements.set('entity-card', entityCard);
    sectionsWrapper.appendChild(entityCard);

    for (const entry of sectionEntries) {
      this.sectionElements.set(entry.id, entry.element);
      sectionsWrapper.appendChild(entry.element);
    }

    this.ensureActiveTab();
    this.updateTabActiveState(this.getLayoutPrefs().activeSection);
  }

  public get element(): HTMLElement {
    return this.root;
  }

  public dispose(): void {
    if (this.refreshAbort) {
      this.refreshAbort.abort();
      this.refreshAbort = null;
    }
    if (this.scrollRaf !== null) {
      window.cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = null;
    }
    this.content.removeEventListener('scroll', this.handleScroll);
    for (const timeoutId of this.activeTimeouts) {
      window.clearTimeout(timeoutId);
    }
    this.activeTimeouts.clear();
    this.sectionElements.clear();
    this.tabButtons.clear();
    this.content.innerHTML = '';
    this.root.remove();
  }

  private beginRefreshScope(): void {
    if (this.refreshAbort) {
      this.refreshAbort.abort();
    }
    for (const timeoutId of this.activeTimeouts) {
      window.clearTimeout(timeoutId);
    }
    this.activeTimeouts.clear();
    this.refreshAbort = new AbortController();
  }

  private setManagedTimeout(handler: () => void, delayMs: number): number {
    const timeoutId = window.setTimeout(() => {
      this.activeTimeouts.delete(timeoutId);
      handler();
    }, delayMs);
    this.activeTimeouts.add(timeoutId);
    return timeoutId;
  }

  private addDebouncedInput(el: HTMLInputElement, handler: () => void, delayMs: number): void {
    el.addEventListener('input', () => {
      const existing = this.debounceTimers.get(el);
      if (existing !== undefined) {
        window.clearTimeout(existing);
        this.activeTimeouts.delete(existing);
      }
      const id = this.setManagedTimeout(() => {
        handler();
      }, delayMs);
      this.debounceTimers.set(el, id);
    }, { signal: this.refreshAbort!.signal });
  }

  private restoreFocus(): void {}

  private announce(_message: string): void {}

  private registerUndo(_action: () => void): void {}

  private performUndo(): void {}

  private getSnapConfig(): {
    enabled: boolean;
    increment: number;
    axes: { x: boolean; y: boolean; z: boolean };
    rotationIncrement: number;
    scaleIncrement: number;
    minScale: number;
  } | null {
    const cfg = this.config.state?.snapConfig.value;
    if (!cfg || !cfg.enabled) return null;
    return cfg;
  }

  private roundToIncrement(value: number, increment: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(increment) || increment <= 0) return value;
    return Math.round(value / increment) * increment;
  }

  private tryUpdateExistingValues(entity: Entity): boolean {
    let anyUpdated = false;

    // Position
    const pos = entity.transform.position;
    const posX = this.content.querySelector('input[data-field="position-x"]') as HTMLInputElement | null;
    if (posX) {
      const posY = this.content.querySelector('input[data-field="position-y"]') as HTMLInputElement | null;
      const posZ = this.content.querySelector('input[data-field="position-z"]') as HTMLInputElement | null;
      // Only update if not currently being edited
      if (document.activeElement !== posX) {
        posX.value = Number.isFinite(pos[0]) ? pos[0].toFixed(2) : '0.00';
      }
      if (posY && document.activeElement !== posY) {
        posY.value = Number.isFinite(pos[1]) ? pos[1].toFixed(2) : '0.00';
      }
      if (posZ && document.activeElement !== posZ) {
        posZ.value = Number.isFinite(pos[2]) ? pos[2].toFixed(2) : '0.00';
      }
      anyUpdated = true;
    }

    // Scale
    const scale = entity.transform.scale;
    const scaleX = this.content.querySelector('input[data-field="scale-x"]') as HTMLInputElement | null;
    if (scaleX) {
      const scaleY = this.content.querySelector('input[data-field="scale-y"]') as HTMLInputElement | null;
      const scaleZ = this.content.querySelector('input[data-field="scale-z"]') as HTMLInputElement | null;
      // Only update if not currently being edited
      if (document.activeElement !== scaleX) {
        scaleX.value = Number.isFinite(scale[0]) ? scale[0].toFixed(2) : '0.00';
      }
      if (scaleY && document.activeElement !== scaleY) {
        scaleY.value = Number.isFinite(scale[1]) ? scale[1].toFixed(2) : '0.00';
      }
      if (scaleZ && document.activeElement !== scaleZ) {
        scaleZ.value = Number.isFinite(scale[2]) ? scale[2].toFixed(2) : '0.00';
      }
      anyUpdated = true;
    }

    // Rotation (degrees)
    const rotX = this.content.querySelector('input[data-field="rotation-x"]') as HTMLInputElement | null;
    if (rotX) {
      const rotY = this.content.querySelector('input[data-field="rotation-y"]') as HTMLInputElement | null;
      const rotZ = this.content.querySelector('input[data-field="rotation-z"]') as HTMLInputElement | null;
      const eulerRad = quatToEuler(entity.transform.rotation);
      const toDeg = (r: number) => (r * 180) / Math.PI;
      // Only update if not currently being edited
      if (document.activeElement !== rotX) {
        rotX.value = Number.isFinite(eulerRad[0]) ? toDeg(eulerRad[0]).toFixed(2) : '0.00';
      }
      if (rotY && document.activeElement !== rotY) {
        rotY.value = Number.isFinite(eulerRad[1]) ? toDeg(eulerRad[1]).toFixed(2) : '0.00';
      }
      if (rotZ && document.activeElement !== rotZ) {
        rotZ.value = Number.isFinite(eulerRad[2]) ? toDeg(eulerRad[2]).toFixed(2) : '0.00';
      }
      anyUpdated = true;
    }

    // Color
    const colorInput = this.content.querySelector('input[data-field="appearance-base-color"]') as HTMLInputElement | null;
    if (colorInput) {
      const hex = rgbaToHex(entity.color).toUpperCase();
      // Only update if not currently being edited
      if (document.activeElement !== colorInput) {
        colorInput.value = hex;
      }
      const swatchInner = this.content.querySelector('[data-field="appearance-base-color-swatch"]') as HTMLElement | null;
      if (swatchInner) swatchInner.style.background = hex;
      const display = this.content.querySelector('input[data-field="appearance-base-color-display"]') as HTMLInputElement | null;
      if (display && document.activeElement !== display) {
        display.value = hex;
      }
      anyUpdated = true;
    }

    // Camera
    const fovInput = this.content.querySelector('input[data-field="camera-fov"]') as HTMLInputElement | null;
    if (fovInput) {
      const cameraComp = entity.getComponent(CameraComponent);
      if (cameraComp) {
        const deg = (cameraComp.fov * 180) / Math.PI;
        // Only update if not currently being edited
        if (document.activeElement !== fovInput) {
          fovInput.value = Number.isFinite(deg) ? deg.toString() : '0';
        }
        const nearInput = this.content.querySelector('input[data-field="camera-near"]') as HTMLInputElement | null;
        const farInput = this.content.querySelector('input[data-field="camera-far"]') as HTMLInputElement | null;
        if (nearInput && document.activeElement !== nearInput) {
          nearInput.value = Number.isFinite(cameraComp.near) ? cameraComp.near.toString() : '0';
        }
        if (farInput && document.activeElement !== farInput) {
          farInput.value = Number.isFinite(cameraComp.far) ? cameraComp.far.toString() : '0';
        }
        const primaryCheck = this.content.querySelector('input[type="checkbox"][data-field="camera-primary"]') as HTMLInputElement | null;
        if (primaryCheck) primaryCheck.checked = entity.scene?.primaryCamera === entity;
        anyUpdated = true;
      }
    }

    return anyUpdated;
  }

  /**
   * Creates a modern entity info card with icon, name, and badges.
   */
  private createEntityCard(entity: Entity): HTMLElement {
    const card = document.createElement('div');
    card.className = 'entity-card';

    // Header row with icon and name
    const headerRow = document.createElement('div');
    headerRow.className = 'entity-card-header';

    // Entity icon with color
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'entity-card-icon';
    const baseColor = entity.color;
    iconWrapper.style.background = rgbaToHex(baseColor);
    iconWrapper.appendChild(createIcon('cube', 20));

    // Name input
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'entity-card-name-input';
    nameInput.value = entity.name;
    nameInput.placeholder = 'Entity Name';

    nameInput.addEventListener('change', () => {
      const newName = nameInput.value.trim();
      if (newName && newName !== entity.name) {
        entity.name = newName;
        this.config.onEntityRenamed(entity);
      } else {
        nameInput.value = entity.name; // Revert if empty
      }
    }, { signal: this.refreshAbort!.signal });

    nameInput.addEventListener('blur', () => {
      if (!nameInput.value.trim()) {
        nameInput.value = entity.name;
      }
    }, { signal: this.refreshAbort!.signal });

    headerRow.appendChild(iconWrapper);
    headerRow.appendChild(nameInput);
    card.appendChild(headerRow);

    // Badges row
    const badgesRow = document.createElement('div');
    badgesRow.className = 'entity-card-badges';

    // Entity type badge
    const assetTag = typeof entity.userData.asset === 'string' ? entity.userData.asset : null;
    const typeBadge = document.createElement('span');
    typeBadge.className = assetTag ? 'entity-badge entity-badge-preset' : 'entity-badge';
    typeBadge.innerHTML = `${createIcon(assetTag ? 'package' : 'box', 12).outerHTML} ${assetTag || 'Custom'}`;

    // ID badge
    const idBadge = document.createElement('span');
    idBadge.className = 'entity-badge entity-badge-id';
    idBadge.innerHTML = `${createIcon('hash', 12).outerHTML} ${entity.id.substring(0, 8)}`;
    idBadge.title = `Entity ID: ${entity.id}`;

    badgesRow.appendChild(typeBadge);
    badgesRow.appendChild(idBadge);
    card.appendChild(badgesRow);

    return card;
  }

  /**
   * Creates a collapsible section with smooth animation.
   */
  private createCollapsibleSection(
    id: string,
    title: string,
    iconName: string,
    content: HTMLElement,
    isCollapsed: boolean,
    onToggle: () => void
  ): HTMLElement {
    const section = document.createElement('div');
    section.className = 'property-section';
    section.id = `inspector-section-${id}`;

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'property-section-header';
    header.setAttribute('aria-expanded', (!isCollapsed).toString());
    header.setAttribute('aria-controls', `inspector-section-${id}-content`);

    const expandIcon = document.createElement('span');
    expandIcon.className = 'property-section-toggle';
    expandIcon.appendChild(createIcon(isCollapsed ? 'chevron-right' : 'chevron-down', 14));

    const sectionIcon = document.createElement('span');
    sectionIcon.className = 'property-section-icon';
    sectionIcon.appendChild(createIcon(iconName as any, 16));

    const titleEl = document.createElement('span');
    titleEl.className = 'property-section-title';
    titleEl.textContent = title;

    header.appendChild(expandIcon);
    header.appendChild(sectionIcon);
    header.appendChild(titleEl);

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'property-section-content';
    contentWrapper.id = `inspector-section-${id}-content`;
    contentWrapper.setAttribute('role', 'region');
    contentWrapper.setAttribute('aria-labelledby', `inspector-section-${id}`);
    if (isCollapsed) {
      contentWrapper.classList.add('collapsed');
    }
    contentWrapper.appendChild(content);

    header.addEventListener('click', () => {
      const willCollapse = !contentWrapper.classList.contains('collapsed');

      if (willCollapse) {
        contentWrapper.classList.add('collapsed');
        header.setAttribute('aria-expanded', 'false');
        expandIcon.innerHTML = '';
        expandIcon.appendChild(createIcon('chevron-right', 14));
      } else {
        contentWrapper.classList.remove('collapsed');
        header.setAttribute('aria-expanded', 'true');
        expandIcon.innerHTML = '';
        expandIcon.appendChild(createIcon('chevron-down', 14));
      }

      onToggle();
    }, { signal: this.refreshAbort!.signal });

    section.appendChild(header);
    section.appendChild(contentWrapper);
    return section;
  }

  /**
   * Creates transform properties content (no wrapper).
   */
  private createTransformProperties(entity: Entity): HTMLElement {
    const container = document.createElement('div');
    container.className = 'property-content';

    // Position with reset button
    container.appendChild(
      createVectorInput({
        label: 'Position',
        values: entity.transform.position,
        onCommit: (next) => {
          const prev = [...entity.transform.position] as Vec3;
          const snap = this.getSnapConfig();
          if (snap) {
            const [x, y, z] = next;
            const xi = snap.axes.x ? this.roundToIncrement(x, snap.increment) : x;
            const yi = snap.axes.y ? this.roundToIncrement(y, snap.increment) : y;
            const zi = snap.axes.z ? this.roundToIncrement(z, snap.increment) : z;
            entity.transform.position = [xi, yi, zi];
          } else {
            entity.transform.position = next;
          }
          this.config.onTransformChanged(entity);
          this.registerUndo(() => {
            entity.transform.position = prev;
            this.config.onTransformChanged(entity);
          });
          this.announce('Position updated');
        },
        onReset: () => {
          const prev = [...entity.transform.position] as Vec3;
          entity.transform.position = [0, 0, 0];
          this.config.onTransformChanged(entity);
          this.refresh();
          this.registerUndo(() => {
            entity.transform.position = prev;
            this.config.onTransformChanged(entity);
          });
          this.announce('Position reset');
        },
        group: 'position',
        abortSignal: this.refreshAbort!.signal,
        debounceMs: 120,
        setManagedTimeout: (fn, ms) => this.setManagedTimeout(fn, ms),
      })
    );

    // Rotation (degrees, XYZ order) with snap
    container.appendChild(
      createVectorInput({
        label: 'Rotation (°)',
        values: (() => {
          const eulerRad = quatToEuler(entity.transform.rotation);
          const toDeg = (r: number) => (r * 180) / Math.PI;
          return [toDeg(eulerRad[0]), toDeg(eulerRad[1]), toDeg(eulerRad[2])] as Vec3;
        })(),
        onCommit: (nextDeg) => {
          const snap = this.getSnapConfig();
          const toRad = (d: number) => (d * Math.PI) / 180;
          const prevEulerRad = quatToEuler(entity.transform.rotation);
          let [dx, dy, dz] = nextDeg;
          if (snap) {
            const incDeg = (snap.rotationIncrement * 180) / Math.PI;
            dx = this.roundToIncrement(dx, incDeg);
            dy = this.roundToIncrement(dy, incDeg);
            dz = this.roundToIncrement(dz, incDeg);
          }
          entity.transform.setEulerAngles(toRad(dx), toRad(dy), toRad(dz));
          this.config.onTransformChanged(entity);
          this.registerUndo(() => {
            entity.transform.setEulerAngles(prevEulerRad[0], prevEulerRad[1], prevEulerRad[2]);
            this.config.onTransformChanged(entity);
          });
          this.announce('Rotation updated');
        },
        onReset: () => {
          const prevEulerRad = quatToEuler(entity.transform.rotation);
          entity.transform.setEulerAngles(0, 0, 0);
          this.config.onTransformChanged(entity);
          this.refresh();
          this.registerUndo(() => {
            entity.transform.setEulerAngles(prevEulerRad[0], prevEulerRad[1], prevEulerRad[2]);
            this.config.onTransformChanged(entity);
          });
          this.announce('Rotation reset');
        },
        group: 'rotation',
        abortSignal: this.refreshAbort!.signal,
        debounceMs: 120,
        setManagedTimeout: (fn, ms) => this.setManagedTimeout(fn, ms),
      })
    );

    // Scale with reset button
    container.appendChild(
      createVectorInput({
        label: 'Scale',
        values: entity.transform.scale,
        onCommit: (next) => {
          const prev = [...entity.transform.scale] as Vec3;
          const snap = this.getSnapConfig();
          const min = snap?.minScale ?? MIN_SCALE;
          let [sx, sy, sz] = next;
          if (snap) {
            sx = this.roundToIncrement(sx, snap.scaleIncrement);
            sy = this.roundToIncrement(sy, snap.scaleIncrement);
            sz = this.roundToIncrement(sz, snap.scaleIncrement);
          }
          entity.transform.scale = [
            Math.max(min, sx),
            Math.max(min, sy),
            Math.max(min, sz),
          ] as Vec3;
          this.config.onTransformChanged(entity);
          this.registerUndo(() => {
            entity.transform.scale = prev;
            this.config.onTransformChanged(entity);
          });
          this.announce('Scale updated');
        },
        onReset: () => {
          const prev = [...entity.transform.scale] as Vec3;
          entity.transform.scale = [1, 1, 1];
          this.config.onTransformChanged(entity);
          this.refresh();
          this.registerUndo(() => {
            entity.transform.scale = prev;
            this.config.onTransformChanged(entity);
          });
          this.announce('Scale reset');
        },
        group: 'scale',
        abortSignal: this.refreshAbort!.signal,
        debounceMs: 120,
        setManagedTimeout: (fn, ms) => this.setManagedTimeout(fn, ms),
      })
    );

    // Precision controls
    container.appendChild(this.createPrecisionControls(entity));

    return container;
  }

  /**
   * Creates precision control buttons
   */
  private createPrecisionControls(entity: Entity): HTMLElement {
    const controls = document.createElement('div');
    controls.className = 'precision-controls';

    // Position controls
    const posControls = document.createElement('div');
    posControls.className = 'precision-group';

    const posLabel = document.createElement('div');
    posLabel.className = 'precision-label';
    posLabel.textContent = 'Position';
    posControls.appendChild(posLabel);

    const posButtons = document.createElement('div');
    posButtons.className = 'precision-buttons';

    // Copy position
    const copyPosBtn = document.createElement('button');
    copyPosBtn.type = 'button';
    copyPosBtn.className = 'precision-btn';
    copyPosBtn.title = 'Copy Position';
    copyPosBtn.appendChild(createIcon('copy', 12));
    copyPosBtn.addEventListener('click', async () => {
      const success = await CoordinateManager.copyToClipboard(entity.transform.position);
      if (success) {
        this.showTempStatus(copyPosBtn, 'Copied!');
        this.announce('Position copied to clipboard');
      }
    }, { signal: this.refreshAbort!.signal });
    posButtons.appendChild(copyPosBtn);

    // Paste position
    const pastePosBtn = document.createElement('button');
    pastePosBtn.type = 'button';
    pastePosBtn.className = 'precision-btn';
    pastePosBtn.title = 'Paste Position';
    pastePosBtn.appendChild(createIcon('paste', 12));
    pastePosBtn.addEventListener('click', async () => {
      const coords = await CoordinateManager.pasteFromClipboard();
      if (coords) {
        const prev = [...entity.transform.position] as Vec3;
        entity.transform.position = coords;
        this.config.onTransformChanged(entity);
        this.refresh();
        this.registerUndo(() => {
          entity.transform.position = prev;
          this.config.onTransformChanged(entity);
        });
        this.announce('Position pasted');
      }
    }, { signal: this.refreshAbort!.signal });
    posButtons.appendChild(pastePosBtn);

    // Snap to grid
    const snapGridBtn = document.createElement('button');
    snapGridBtn.type = 'button';
    snapGridBtn.className = 'precision-btn';
    snapGridBtn.title = 'Snap to Grid';
    snapGridBtn.appendChild(createIcon('grid', 12));
    snapGridBtn.addEventListener('click', () => {
      const snap = this.getSnapConfig();
      const gridSize = snap?.increment ?? 0.5;
      const prev = [...entity.transform.position] as Vec3;
      entity.transform.position = CoordinateManager.snapVectorToGrid(
        entity.transform.position,
        gridSize
      );
      this.config.onTransformChanged(entity);
      this.refresh();
      this.registerUndo(() => {
        entity.transform.position = prev;
        this.config.onTransformChanged(entity);
      });
      this.announce('Snapped to grid');
    }, { signal: this.refreshAbort!.signal });
    posButtons.appendChild(snapGridBtn);

    // Reset to origin
    const resetPosBtn = document.createElement('button');
    resetPosBtn.type = 'button';
    resetPosBtn.className = 'precision-btn';
    resetPosBtn.title = 'Reset to Origin';
    resetPosBtn.appendChild(createIcon('circle', 12));
    resetPosBtn.addEventListener('click', () => {
      const prev = [...entity.transform.position] as Vec3;
      entity.transform.position = [0, 0, 0];
      this.config.onTransformChanged(entity);
      this.refresh();
      this.registerUndo(() => {
        entity.transform.position = prev;
        this.config.onTransformChanged(entity);
      });
      this.announce('Position reset to origin');
    }, { signal: this.refreshAbort!.signal });
    posButtons.appendChild(resetPosBtn);

    posControls.appendChild(posButtons);
    controls.appendChild(posControls);

    // Rotation controls
    const rotControls = document.createElement('div');
    rotControls.className = 'precision-group';

    const rotLabel = document.createElement('div');
    rotLabel.className = 'precision-label';
    rotLabel.textContent = 'Rotation';
    rotControls.appendChild(rotLabel);

    const rotButtons = document.createElement('div');
    rotButtons.className = 'precision-buttons';

    // Copy rotation
    const copyRotBtn = document.createElement('button');
    copyRotBtn.type = 'button';
    copyRotBtn.className = 'precision-btn';
    copyRotBtn.title = 'Copy Rotation';
    copyRotBtn.appendChild(createIcon('copy', 12));
    copyRotBtn.addEventListener('click', async () => {
      const success = await QuaternionHelper.copyToClipboard(entity.transform.rotation);
      if (success) {
        this.showTempStatus(copyRotBtn, 'Copied!');
        this.announce('Rotation copied to clipboard');
      }
    }, { signal: this.refreshAbort!.signal });
    rotButtons.appendChild(copyRotBtn);

    // Paste rotation
    const pasteRotBtn = document.createElement('button');
    pasteRotBtn.type = 'button';
    pasteRotBtn.className = 'precision-btn';
    pasteRotBtn.title = 'Paste Rotation';
    pasteRotBtn.appendChild(createIcon('paste', 12));
    pasteRotBtn.addEventListener('click', async () => {
      const rotation = await QuaternionHelper.pasteFromClipboard();
      if (rotation) {
        entity.transform.rotation = rotation;
        this.config.onTransformChanged(entity);
        this.refresh();
      }
    }, { signal: this.refreshAbort!.signal });
    rotButtons.appendChild(pasteRotBtn);

    // Quick rotate buttons
    const quickRotate = (axis: 'x' | 'y' | 'z', degrees: number) => {
      const helper = QuaternionHelper;
      let newRot;
      switch (axis) {
        case 'x': newRot = helper.rotateX(entity.transform.rotation, degrees); break;
        case 'y': newRot = helper.rotateY(entity.transform.rotation, degrees); break;
        case 'z': newRot = helper.rotateZ(entity.transform.rotation, degrees); break;
      }
      entity.transform.rotation = newRot;
      this.config.onTransformChanged(entity);
      this.refresh();
    };

    // Quick rotation presets - 45° increments
    const rotPresets = [
      { deg: 45, label: '45°' },
      { deg: 90, label: '90°' },
      { deg: 180, label: '180°' },
    ];

    rotPresets.forEach(preset => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'precision-btn';
      btn.title = `Rotate Y ${preset.label}`;
      btn.textContent = preset.label;
      btn.addEventListener('click', () => quickRotate('y', preset.deg), { signal: this.refreshAbort!.signal });
      rotButtons.appendChild(btn);
    });

    // Reset rotation
    const resetRotBtn = document.createElement('button');
    resetRotBtn.type = 'button';
    resetRotBtn.className = 'precision-btn';
    resetRotBtn.title = 'Reset Rotation';
    resetRotBtn.appendChild(createIcon('rotate', 12));
    resetRotBtn.addEventListener('click', () => {
      const prevEuler = quatToEuler(entity.transform.rotation);
      entity.transform.rotation = QuaternionHelper.identity();
      this.config.onTransformChanged(entity);
      this.refresh();
      this.registerUndo(() => {
        entity.transform.setEulerAngles(prevEuler[0], prevEuler[1], prevEuler[2]);
        this.config.onTransformChanged(entity);
      });
      this.announce('Rotation reset');
    }, { signal: this.refreshAbort!.signal });
    rotButtons.appendChild(resetRotBtn);

    rotControls.appendChild(rotButtons);
    controls.appendChild(rotControls);

    // Scale controls with presets
    const scaleControls = document.createElement('div');
    scaleControls.className = 'precision-group';

    const scaleLabel = document.createElement('div');
    scaleLabel.className = 'precision-label';
    scaleLabel.textContent = 'Scale';
    scaleControls.appendChild(scaleLabel);

    const scaleButtons = document.createElement('div');
    scaleButtons.className = 'precision-buttons';

    // Scale presets
    const scalePresets = [
      { value: 0.5, label: '0.5×' },
      { value: 1.0, label: '1×' },
      { value: 2.0, label: '2×' },
      { value: 5.0, label: '5×' },
    ];

    scalePresets.forEach(preset => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'precision-btn';
      btn.title = `Set scale to ${preset.label}`;
      btn.textContent = preset.label;
      btn.addEventListener('click', () => {
        const prev = [...entity.transform.scale] as Vec3;
        entity.transform.scale = [preset.value, preset.value, preset.value];
        this.config.onTransformChanged(entity);
        this.refresh();
        this.registerUndo(() => {
          entity.transform.scale = prev;
          this.config.onTransformChanged(entity);
        });
        this.announce(`Scale set to ${preset.label}`);
      }, { signal: this.refreshAbort!.signal });
      scaleButtons.appendChild(btn);
    });

    scaleControls.appendChild(scaleButtons);
    controls.appendChild(scaleControls);

    return controls;
  }

  /**
   * Shows temporary status on button
   */
  private showTempStatus(button: HTMLButtonElement, message: string): void {
    const originalHTML = button.innerHTML;
    button.innerHTML = message;
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
    this.announce(message);
    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.disabled = false;
      button.setAttribute('aria-disabled', 'false');
    }, 800);
  }

  /**
   * Creates appearance properties content (no wrapper).
   */
  private createAppearanceProperties(entity: Entity): HTMLElement {
    const container = document.createElement('div');
    container.className = 'property-content';

    // Check if entity has textured material (can't change color for textured blocks)
    const materialComp = entity.getComponent(MaterialComponent);
    const hasTexture = this.entityHasTexture(entity, materialComp);

    if (hasTexture) {
      // Show info message that color can't be changed for textured blocks
      const info = document.createElement('div');
      info.className = 'property-info-message';
      info.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a1 1 0 011 1v4a1 1 0 01-2 0V5a1 1 0 011-1zm0 8a1 1 0 110-2 1 1 0 010 2z"/>
        </svg>
        <span>This block uses a texture. Color can only be changed for solid color blocks (plastic blocks).</span>
      `;
      container.appendChild(info);
    } else {
      // Color property with modern picker (only for solid color blocks)
      container.appendChild(
        createColorPicker({
          value: entity.color,
          onChange: (next) => this.config.onColorChanged(entity, next),
          abortSignal: this.refreshAbort!.signal,
          setManagedTimeout: (fn, ms) => this.setManagedTimeout(fn, ms),
          dataFieldPrefix: 'appearance-base-color',
        })
      );
    }

    return container;
  }

  /**
   * Determines if entity has a texture (vs solid color).
   * Textured materials: stone, wood, metal, grass, dirt, brick, glass, gold, sand, concrete, ice
   * Solid color materials: plastic blocks (materialId 10-13), custom entities with materialId 0
   */
  private entityHasTexture(entity: Entity, materialComp: MaterialComponent | null): boolean {
    if (!materialComp) {
      // No material component = custom entity with solid color
      return false;
    }

    const matId = materialComp.materialId;
    
    // Plastic blocks (10-13) are solid color and can be tinted
    if (matId >= 10 && matId <= 13) {
      return false;
    }

    // materialId 0 = default/custom entity without specific texture
    // Allow color change unless it has blockId/asset indicating it uses texture atlas
    if (matId === 0) {
      const hasBlockId = entity.userData.blockId || entity.userData.asset;
      return !!hasBlockId;
    }

    // All other materialIds (1-9, 14-15) are textured materials
    // 1=stone, 2=wood, 3=metal, 4=grass, 5=dirt, 6=brick, 7=glass, 8=gold, 9=sand, 14=concrete, 15=ice
    return true;
  }

  /**
   * Creates camera preview
   */
  private createCameraPreview(_entity: Entity, camera: CameraComponent): HTMLElement {
    const preview = document.createElement('div');
    preview.className = 'camera-preview-container';

    const previewHeader = document.createElement('div');
    previewHeader.className = 'camera-preview-header';

    const previewLabel = document.createElement('div');
    previewLabel.className = 'camera-preview-label';
    previewLabel.appendChild(createIcon('camera', 14));
    const labelText = document.createElement('span');
    labelText.textContent = 'Camera Preview';
    previewLabel.appendChild(labelText);

    const previewInfo = document.createElement('div');
    previewInfo.className = 'camera-preview-info';
    const fovDeg = Math.round((camera.fov * 180) / Math.PI);
    previewInfo.textContent = `${fovDeg}° FOV`;

    previewHeader.appendChild(previewLabel);
    previewHeader.appendChild(previewInfo);

    const canvas = document.createElement('canvas');
    canvas.className = 'camera-preview-canvas';
    canvas.width = 320;
    canvas.height = 180;

    // Draw simple wireframe preview
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, 180);
      gradient.addColorStop(0, '#1a2332');
      gradient.addColorStop(1, '#0f1419');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 320, 180);

      // Grid
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 320; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 180);
        ctx.stroke();
      }
      for (let i = 0; i <= 180; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(320, i);
        ctx.stroke();
      }

      // Center crosshair
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(160, 80);
      ctx.lineTo(160, 100);
      ctx.moveTo(150, 90);
      ctx.lineTo(170, 90);
      ctx.stroke();

      // FOV indicator (simple frustum)
      const fovFactor = camera.fov / (Math.PI / 2); // Normalize to 90°
      const spreadX = 60 * fovFactor;
      const spreadY = 40 * fovFactor;
      
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(160, 90);
      ctx.lineTo(160 - spreadX, 90 - spreadY);
      ctx.moveTo(160, 90);
      ctx.lineTo(160 + spreadX, 90 - spreadY);
      ctx.moveTo(160, 90);
      ctx.lineTo(160 - spreadX, 90 + spreadY);
      ctx.moveTo(160, 90);
      ctx.lineTo(160 + spreadX, 90 + spreadY);
      ctx.stroke();

      // FOV text
      ctx.fillStyle = 'rgba(14, 165, 233, 0.8)';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${fovDeg}°`, 160, 20);
    }

    preview.appendChild(previewHeader);
    preview.appendChild(canvas);
    return preview;
  }

  /**
   * Creates FOV presets
   */
  private createCameraFOVPresets(camera: CameraComponent): HTMLElement {
    const presets = document.createElement('div');
    presets.className = 'camera-fov-presets';

    const presetsLabel = document.createElement('div');
    presetsLabel.className = 'precision-label';
    presetsLabel.textContent = 'FOV Presets';

    const presetsButtons = document.createElement('div');
    presetsButtons.className = 'camera-preset-buttons';

    const fovPresets = [
      { deg: 45, label: 'Telephoto', desc: '45° (Zoom in)' },
      { deg: 60, label: 'Normal', desc: '60° (Default)' },
      { deg: 75, label: 'Wide', desc: '75° (Wider view)' },
      { deg: 90, label: 'Ultra-Wide', desc: '90° (Very wide)' },
    ];

    fovPresets.forEach(preset => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'camera-preset-btn';
      btn.title = preset.desc;
      
      const label = document.createElement('div');
      label.className = 'camera-preset-label';
      label.textContent = preset.label;
      
      const value = document.createElement('div');
      value.className = 'camera-preset-value';
      value.textContent = `${preset.deg}°`;
      
      btn.appendChild(label);
      btn.appendChild(value);
      
      btn.addEventListener('click', () => {
        camera.fov = (preset.deg * Math.PI) / 180;
        this.refresh();
        this.announce(`FOV set to ${preset.deg}°`);
      }, { signal: this.refreshAbort!.signal });
      
      presetsButtons.appendChild(btn);
    });

    presets.appendChild(presetsLabel);
    presets.appendChild(presetsButtons);
    return presets;
  }

  /**
   * Creates camera properties content (no wrapper).
   */
  private createCameraProperties(entity: Entity, camera: CameraComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = 'property-content';

    // Camera preview
    container.appendChild(this.createCameraPreview(entity, camera));

    // FOV presets header
    container.appendChild(this.createCameraFOVPresets(camera));

    // FOV with slider and input
    container.appendChild(
      this.createNumberPropertyV2(
        'Field of View',
        (camera.fov * 180) / Math.PI,
        (value) => {
          if (!Number.isFinite(value)) return;
          const radians = (value * Math.PI) / 180;
          if (radians <= 0 || radians >= Math.PI) return;
          camera.fov = radians;
        },
        '°',
        45,
        120,
        1
      )
    );

    // Near plane
    container.appendChild(
      this.createNumberPropertyV2(
        'Near Plane',
        camera.near,
        (value) => {
          if (!Number.isFinite(value) || value <= 0 || value >= camera.far) return;
          camera.near = value;
        },
        '',
        0.1,
        10,
        0.1
      )
    );

    // Far plane
    container.appendChild(
      this.createNumberPropertyV2(
        'Far Plane',
        camera.far,
        (value) => {
          if (!Number.isFinite(value) || value <= camera.near) return;
          camera.far = value;
        },
        '',
        100,
        10000,
        100
      )
    );

    // Primary camera toggle (modern switch)
    container.appendChild(
      this.createTogglePropertyV2(
        'Primary Camera',
        entity.scene?.primaryCamera === entity,
        (checked) => {
          entity.scene?.setPrimaryCamera(checked ? entity : null);
        }
      )
    );

    return container;
  }

  /**
   * Creates skybox preview
   */
  private createSkyboxPreview(environment: EnvironmentComponent): HTMLElement {
    const preview = document.createElement('div');
    preview.className = 'skybox-preview-container';

    const previewHeader = document.createElement('div');
    previewHeader.className = 'skybox-preview-header';

    const previewLabel = document.createElement('div');
    previewLabel.className = 'skybox-preview-label';
    previewLabel.appendChild(createIcon('sun', 14));
    const labelText = document.createElement('span');
    labelText.textContent = 'Skybox Preview';
    previewLabel.appendChild(labelText);

    const previewType = document.createElement('div');
    previewType.className = 'skybox-preview-type';
    previewType.textContent = environment.skyboxType;

    previewHeader.appendChild(previewLabel);
    previewHeader.appendChild(previewType);

    const canvas = document.createElement('canvas');
    canvas.className = 'skybox-preview-canvas';
    canvas.width = 320;
    canvas.height = 180;

    // Draw skybox preview based on type
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (environment.skyboxType === 'solid') {
        // Solid color fill
        ctx.fillStyle = `rgb(${environment.skyColor[0] * 255}, ${environment.skyColor[1] * 255}, ${environment.skyColor[2] * 255})`;
        ctx.fillRect(0, 0, 320, 180);
      } else if (environment.skyboxType === 'gradient') {
        // Gradient from sky to horizon to ground
        const gradient = ctx.createLinearGradient(0, 0, 0, 180);
        gradient.addColorStop(0, `rgb(${environment.skyColor[0] * 255}, ${environment.skyColor[1] * 255}, ${environment.skyColor[2] * 255})`);
        gradient.addColorStop(0.5, `rgb(${environment.horizonColor[0] * 255}, ${environment.horizonColor[1] * 255}, ${environment.horizonColor[2] * 255})`);
        gradient.addColorStop(1, `rgb(${environment.groundColor[0] * 255}, ${environment.groundColor[1] * 255}, ${environment.groundColor[2] * 255})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 320, 180);
      } else if (environment.skyboxType === 'procedural-sky') {
        // Procedural sky with sun
        const gradient = ctx.createLinearGradient(0, 0, 0, 180);
        gradient.addColorStop(0, `rgb(${environment.skyColor[0] * 255}, ${environment.skyColor[1] * 255}, ${environment.skyColor[2] * 255})`);
        gradient.addColorStop(1, `rgb(${environment.horizonColor[0] * 255}, ${environment.horizonColor[1] * 255}, ${environment.horizonColor[2] * 255})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 320, 180);

        // Draw sun
        const sunX = 160 + environment.sunDirection[0] * 100;
        const sunY = 90 - environment.sunDirection[1] * 60;
        
        // Sun glow
        const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 40);
        sunGlow.addColorStop(0, `rgba(${environment.sunColor[0] * 255}, ${environment.sunColor[1] * 255}, ${environment.sunColor[2] * 255}, ${environment.sunIntensity * 0.3})`);
        sunGlow.addColorStop(0.5, `rgba(${environment.sunColor[0] * 255}, ${environment.sunColor[1] * 255}, ${environment.sunColor[2] * 255}, ${environment.sunIntensity * 0.1})`);
        sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, 320, 180);

        // Sun disc
        ctx.beginPath();
        ctx.arc(sunX, sunY, 15, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${environment.sunColor[0] * 255}, ${environment.sunColor[1] * 255}, ${environment.sunColor[2] * 255}, ${environment.sunIntensity})`;
        ctx.fill();
      } else if (environment.skyboxType === 'cubemap') {
        // Placeholder for cubemap
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, 320, 180);
        ctx.fillStyle = 'rgba(14, 165, 233, 0.3)';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Cubemap', 160, 90);
      }
    }

    preview.appendChild(previewHeader);
    preview.appendChild(canvas);
    return preview;
  }

  /**
   * Creates time of day presets
   */
  private createTimeOfDayPresets(environment: EnvironmentComponent): HTMLElement {
    const presets = document.createElement('div');
    presets.className = 'time-of-day-presets';

    const presetsLabel = document.createElement('div');
    presetsLabel.className = 'precision-label';
    presetsLabel.textContent = 'Time Presets';

    const presetsButtons = document.createElement('div');
    presetsButtons.className = 'time-preset-buttons';

    const timePresets = [
      { hours: 6, label: 'Dawn', icon: '🌅', desc: 'Early morning (6:00)' },
      { hours: 12, label: 'Noon', icon: '☀️', desc: 'Midday (12:00)' },
      { hours: 18, label: 'Dusk', icon: '🌇', desc: 'Evening (18:00)' },
      { hours: 0, label: 'Night', icon: '🌙', desc: 'Midnight (00:00)' },
    ];

    timePresets.forEach(preset => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'time-preset-btn';
      btn.title = preset.desc;
      
      const icon = document.createElement('div');
      icon.className = 'time-preset-icon';
      icon.textContent = preset.icon;
      
      const label = document.createElement('div');
      label.className = 'time-preset-label';
      label.textContent = preset.label;
      
      btn.appendChild(icon);
      btn.appendChild(label);
      
      btn.addEventListener('click', () => {
        environment.setTimeOfDay(preset.hours);
        this.refresh();
        this.announce(`Time set to ${preset.label}`);
      }, { signal: this.refreshAbort!.signal });
      
      presetsButtons.appendChild(btn);
    });

    presets.appendChild(presetsLabel);
    presets.appendChild(presetsButtons);
    return presets;
  }

  /**
   * Creates fog presets
   */
  private createFogPresets(environment: EnvironmentComponent): HTMLElement {
    const presets = document.createElement('div');
    presets.className = 'fog-presets';

    const presetsLabel = document.createElement('div');
    presetsLabel.className = 'precision-label';
    presetsLabel.textContent = 'Fog Presets';

    const presetsButtons = document.createElement('div');
    presetsButtons.className = 'fog-preset-buttons';

    const fogPresets = [
      { 
        label: 'Clear', 
        near: 50, 
        far: 200, 
        density: 0.001, 
        color: [0.8, 0.9, 1.0] as Vec3,
        desc: 'Minimal fog'
      },
      { 
        label: 'Light', 
        near: 20, 
        far: 100, 
        density: 0.015, 
        color: [0.7, 0.8, 0.9] as Vec3,
        desc: 'Light atmospheric haze'
      },
      { 
        label: 'Medium', 
        near: 10, 
        far: 60, 
        density: 0.03, 
        color: [0.6, 0.7, 0.8] as Vec3,
        desc: 'Moderate fog'
      },
      { 
        label: 'Heavy', 
        near: 5, 
        far: 30, 
        density: 0.06, 
        color: [0.5, 0.6, 0.7] as Vec3,
        desc: 'Dense fog'
      },
    ];

    fogPresets.forEach(preset => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fog-preset-btn';
      btn.title = preset.desc;
      btn.textContent = preset.label;
      
      btn.addEventListener('click', () => {
        if (environment.fogMode === 'linear') {
          environment.fogNear = preset.near;
          environment.fogFar = preset.far;
        } else {
          environment.fogDensity = preset.density;
        }
        environment.fogColor = [...preset.color];
        this.refresh();
        this.announce(`Fog preset: ${preset.label}`);
      }, { signal: this.refreshAbort!.signal });
      
      presetsButtons.appendChild(btn);
    });

    presets.appendChild(presetsLabel);
    presets.appendChild(presetsButtons);
    return presets;
  }

  /**
   * Creates environment/skybox properties content (no wrapper).
   */
  private createEnvironmentProperties(_entity: Entity, environment: EnvironmentComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = 'property-content';

    // Skybox preview
    container.appendChild(this.createSkyboxPreview(environment));

    // Enabled toggle
    container.appendChild(
      this.createTogglePropertyV2(
        'Enabled',
        environment.enabled,
        (checked) => {
          environment.enabled = checked;
        }
      )
    );

    // Skybox Type dropdown
    const skyboxTypeRow = document.createElement('div');
    skyboxTypeRow.className = 'property-row';

    const skyboxTypeLabel = document.createElement('label');
    skyboxTypeLabel.className = 'property-label-v2';
    skyboxTypeLabel.textContent = 'Skybox Type';

    const skyboxTypeSelect = document.createElement('select');
    skyboxTypeSelect.className = 'property-select-v2';
    const types = ['solid', 'gradient', 'procedural-sky', 'cubemap'];
    for (const type of types) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      if (environment.skyboxType === type) {
        option.selected = true;
      }
      skyboxTypeSelect.appendChild(option);
    }
    skyboxTypeSelect.addEventListener('change', () => {
      environment.skyboxType = skyboxTypeSelect.value as typeof environment.skyboxType;
      this.refresh();
    }, { signal: this.refreshAbort!.signal });

    skyboxTypeRow.appendChild(skyboxTypeLabel);
    skyboxTypeRow.appendChild(skyboxTypeSelect);
    container.appendChild(skyboxTypeRow);

    // Sky Color
    container.appendChild(
      createColorPicker({
        label: 'Sky Color',
        value: [environment.skyColor[0], environment.skyColor[1], environment.skyColor[2], 1],
        onChange: (color) => {
          environment.skyColor = [color[0], color[1], color[2]];
        },
        abortSignal: this.refreshAbort!.signal,
        setManagedTimeout: (fn, ms) => this.setManagedTimeout(fn, ms),
      })
    );

    // Horizon Color (for gradient and procedural-sky)
    if (environment.skyboxType === 'gradient' || environment.skyboxType === 'procedural-sky') {
      container.appendChild(
        createColorPicker({
          label: 'Horizon Color',
          value: [environment.horizonColor[0], environment.horizonColor[1], environment.horizonColor[2], 1],
          onChange: (color) => {
            environment.horizonColor = [color[0], color[1], color[2]];
          },
          abortSignal: this.refreshAbort!.signal,
          setManagedTimeout: (fn, ms) => this.setManagedTimeout(fn, ms),
        })
      );
    }

    // Ground Color (for gradient)
    if (environment.skyboxType === 'gradient') {
      container.appendChild(
        createColorPicker({
          label: 'Ground Color',
          value: [environment.groundColor[0], environment.groundColor[1], environment.groundColor[2], 1],
          onChange: (color) => {
            environment.groundColor = [color[0], color[1], color[2]];
          },
          abortSignal: this.refreshAbort!.signal,
          setManagedTimeout: (fn, ms) => this.setManagedTimeout(fn, ms),
        })
      );
    }

    // Sun properties (for procedural-sky)
    if (environment.skyboxType === 'procedural-sky') {
      // Sun Direction
      const sunDirInput = createVectorInput({
        label: 'Sun Direction',
        values: environment.sunDirection,
        onCommit: (value: Vec3) => {
          environment.sunDirection = value;
          environment.normalizeSunDirection();
        },
        abortSignal: this.refreshAbort!.signal,
      });
      container.appendChild(sunDirInput);

      // Sun Color
      container.appendChild(
        createColorPicker({
          label: 'Sun Color',
          value: [environment.sunColor[0], environment.sunColor[1], environment.sunColor[2], 1],
          onChange: (color) => {
            environment.sunColor = [color[0], color[1], color[2]];
          },
          abortSignal: this.refreshAbort!.signal,
          setManagedTimeout: (fn, ms) => this.setManagedTimeout(fn, ms),
        })
      );

      // Sun Intensity
      container.appendChild(
        this.createNumberPropertyV2(
          'Sun Intensity',
          environment.sunIntensity,
          (value) => {
            if (!Number.isFinite(value) || value < 0) return;
            environment.sunIntensity = value;
          },
          '',
          0,
          2,
          0.1
        )
      );

      // Time of Day presets
      container.appendChild(this.createTimeOfDayPresets(environment));

      // Time of Day helper
      const timeOfDayRow = document.createElement('div');
      timeOfDayRow.className = 'property-row';

      const timeOfDayLabel = document.createElement('label');
      timeOfDayLabel.className = 'property-label-v2';
      timeOfDayLabel.textContent = 'Time of Day';

      const timeOfDayInput = document.createElement('input');
      timeOfDayInput.type = 'range';
      timeOfDayInput.className = 'property-slider-v2';
      timeOfDayInput.min = '0';
      timeOfDayInput.max = '24';
      timeOfDayInput.step = '0.5';
      timeOfDayInput.value = '12';

      const timeOfDayValue = document.createElement('span');
      timeOfDayValue.className = 'property-value-v2';
      timeOfDayValue.textContent = '12:00';

      timeOfDayInput.addEventListener('input', () => {
        const hours = parseFloat(timeOfDayInput.value);
        const displayHours = Math.floor(hours);
        const displayMinutes = Math.floor((hours % 1) * 60);
        timeOfDayValue.textContent = `${displayHours.toString().padStart(2, '0')}:${displayMinutes.toString().padStart(2, '0')}`;
        environment.setTimeOfDay(hours);
        this.refresh();
      }, { signal: this.refreshAbort!.signal });

      timeOfDayRow.appendChild(timeOfDayLabel);
      timeOfDayRow.appendChild(timeOfDayInput);
      timeOfDayRow.appendChild(timeOfDayValue);
      container.appendChild(timeOfDayRow);
    }

    // Ambient Intensity
    container.appendChild(
      this.createNumberPropertyV2(
        'Ambient Intensity',
        environment.ambientIntensity,
        (value) => {
          if (!Number.isFinite(value) || value < 0) return;
          environment.ambientIntensity = value;
        },
        '',
        0,
        1,
        0.05
      )
    );

    // Exposure
    container.appendChild(
      this.createNumberPropertyV2(
        'Exposure',
        environment.exposure,
        (value) => {
          if (!Number.isFinite(value) || value <= 0) return;
          environment.exposure = value;
        },
        '',
        0.1,
        3,
        0.1
      )
    );

    // Fog Mode dropdown
    const fogModeRow = document.createElement('div');
    fogModeRow.className = 'property-row';

    const fogModeLabel = document.createElement('label');
    fogModeLabel.className = 'property-label-v2';
    fogModeLabel.textContent = 'Fog Mode';

    const fogModeSelect = document.createElement('select');
    fogModeSelect.className = 'property-select-v2';
    const fogModes = ['none', 'linear', 'exponential', 'exponential-squared'];
    for (const mode of fogModes) {
      const option = document.createElement('option');
      option.value = mode;
      option.textContent = mode
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      if (environment.fogMode === mode) {
        option.selected = true;
      }
      fogModeSelect.appendChild(option);
    }
    fogModeSelect.addEventListener('change', () => {
      environment.fogMode = fogModeSelect.value as typeof environment.fogMode;
      this.refresh();
    }, { signal: this.refreshAbort!.signal });

    fogModeRow.appendChild(fogModeLabel);
    fogModeRow.appendChild(fogModeSelect);
    container.appendChild(fogModeRow);

    // Fog properties (if fog is enabled)
    if (environment.fogMode !== 'none') {
      // Fog presets
      container.appendChild(this.createFogPresets(environment));

      // Fog Color
      container.appendChild(
        createColorPicker({
          label: 'Fog Color',
          value: [environment.fogColor[0], environment.fogColor[1], environment.fogColor[2], 1],
          onChange: (color) => {
            environment.fogColor = [color[0], color[1], color[2]];
          },
          abortSignal: this.refreshAbort!.signal,
          setManagedTimeout: (fn, ms) => this.setManagedTimeout(fn, ms),
        })
      );

      if (environment.fogMode === 'linear') {
        // Fog Near
        container.appendChild(
          this.createNumberPropertyV2(
            'Fog Near',
            environment.fogNear,
            (value) => {
              if (!Number.isFinite(value) || value < 0 || value >= environment.fogFar) return;
              environment.fogNear = value;
            },
            '',
            0,
            100,
            1
          )
        );

        // Fog Far
        container.appendChild(
          this.createNumberPropertyV2(
            'Fog Far',
            environment.fogFar,
            (value) => {
              if (!Number.isFinite(value) || value <= environment.fogNear) return;
              environment.fogFar = value;
            },
            '',
            10,
            500,
            10
          )
        );
      } else {
        // Fog Density (for exponential modes)
        container.appendChild(
          this.createNumberPropertyV2(
            'Fog Density',
            environment.fogDensity,
            (value) => {
              if (!Number.isFinite(value) || value < 0) return;
              environment.fogDensity = value;
            },
            '',
            0,
            0.1,
            0.001
          )
        );
      }
    }

    return container;
  }

  /**
   * Creates simplified scripting properties: list assigned scripts with delete buttons.
   * For full editing, users can open the Script Workbench.
   */
  private createScriptsProperties(entity: Entity, scripts: ScriptComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = 'property-content';

    const state: ScriptComponentState = scripts.toJSON();

    // If no scripts attached, show empty state with add button
    if (state.scripts.length === 0) {
      const emptyText = document.createElement('p');
      emptyText.className = 'muted-text';
      emptyText.textContent = 'No scripts attached.';
      container.appendChild(emptyText);

      const addScriptBtn = document.createElement('button');
      addScriptBtn.type = 'button';
      addScriptBtn.className = 'script-add-btn';
      addScriptBtn.appendChild(createIcon('plus', 16));
      const addText = document.createElement('span');
      addText.textContent = 'Add Script';
      addScriptBtn.appendChild(addText);
      addScriptBtn.addEventListener('click', () => {
        state.scripts.push({ name: '', enabled: true });
        scripts.setScripts(state.scripts);
        this.refresh();
        // Focus the new input after refresh
        this.setManagedTimeout(() => {
          const inputs = this.content.querySelectorAll('.script-item-name-input');
          const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
          lastInput?.focus();
        }, 50);
      }, { signal: this.refreshAbort!.signal });
      container.appendChild(addScriptBtn);

      const workbenchBtn = document.createElement('button');
      workbenchBtn.type = 'button';
      workbenchBtn.className = 'script-workbench-link-btn';
      workbenchBtn.appendChild(createIcon('edit', 14));
      const btnText = document.createElement('span');
      btnText.textContent = 'Open Script Workbench';
      workbenchBtn.appendChild(btnText);
      workbenchBtn.addEventListener('click', () => {
        this.config.onOpenScriptWorkbench?.();
      }, { signal: this.refreshAbort!.signal });
      container.appendChild(workbenchBtn);

      return container;
    }

    // Scripts list - show each script with drag & drop, inline editing
    const list = document.createElement('div');
    list.className = 'script-list-simple';

    for (let i = 0; i < state.scripts.length; i++) {
      const def = state.scripts[i]!;

      const row = document.createElement('div');
      row.className = 'script-item';
      row.dataset.index = i.toString();

      // Drag handle
      const dragHandle = document.createElement('div');
      dragHandle.className = 'script-item-drag-handle';
      dragHandle.draggable = true;
      dragHandle.title = 'Drag to reorder';
      dragHandle.appendChild(createIcon('move', 16));

      // Name display matching tests (non-editing summary row)
      const nameSpan = document.createElement('span');
      nameSpan.className = 'script-item-name';
      nameSpan.textContent = def.name || '';
      // Validation indicator for invalid scripts
      const valid = !!def.name && BehaviorRegistry.has(def.name);
      if (!valid && def.name) {
        nameSpan.classList.add('script-item-invalid');
        nameSpan.title = 'Behavior not found in registry';
      }

      // Toggle switch for enabled/disabled
      const toggleWrapper = document.createElement('div');
      toggleWrapper.className = 'script-item-toggle';
      
      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'toggle-switch toggle-switch-sm';
      
      const toggleInput = document.createElement('input');
      toggleInput.type = 'checkbox';
      toggleInput.checked = def.enabled ?? true;
      toggleInput.addEventListener('change', () => {
        def.enabled = toggleInput.checked;
        scripts.setScripts(state.scripts);
        this.refresh();
        this.announce(`Script ${def.enabled ? 'enabled' : 'disabled'}`);
      }, { signal: this.refreshAbort!.signal });
      
      const toggleSlider = document.createElement('span');
      toggleSlider.className = 'toggle-slider';
      
      toggleLabel.appendChild(toggleInput);
      toggleLabel.appendChild(toggleSlider);
      toggleWrapper.appendChild(toggleLabel);

      // Status label to satisfy tests
      const statusLabel = document.createElement('span');
      statusLabel.className = 'script-item-status';
      const enabledNow = def.enabled ?? true;
      statusLabel.textContent = enabledNow ? 'Enabled' : 'Disabled';
      statusLabel.classList.add(enabledNow ? 'enabled' : 'disabled');

      // Duplicate button
      const duplicateBtn = document.createElement('button');
      duplicateBtn.type = 'button';
      duplicateBtn.className = 'script-item-duplicate';
      duplicateBtn.title = 'Duplicate script';
      duplicateBtn.appendChild(createIcon('copy', 14));
      duplicateBtn.addEventListener('click', () => {
        const cloned: ScriptDefinition = {
          name: def.name,
          enabled: def.enabled ?? true
        };
        if (def.params) {
          cloned.params = { ...def.params };
        }
        state.scripts.splice(i + 1, 0, cloned);
        scripts.setScripts(state.scripts);
        this.refresh();
        this.announce('Script duplicated');
      }, { signal: this.refreshAbort!.signal });

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'script-item-delete';
      deleteBtn.title = 'Remove script';
      deleteBtn.appendChild(createIcon('trash', 14));
      deleteBtn.addEventListener('click', () => {
        state.scripts.splice(i, 1);
        scripts.setScripts(state.scripts);
        this.config.onEntityRenamed(entity);
        this.refresh();
        this.announce('Script removed');
      }, { signal: this.refreshAbort!.signal });

      row.appendChild(dragHandle);
      row.appendChild(nameSpan);
      row.appendChild(statusLabel);
      row.appendChild(toggleWrapper);
      row.appendChild(duplicateBtn);
      row.appendChild(deleteBtn);
      list.appendChild(row);
    }

    // Setup drag and drop
    this.setupScriptDragAndDrop(list, scripts, entity);

    container.appendChild(list);

    // Action buttons row
    const actionsRow = document.createElement('div');
    actionsRow.className = 'script-actions-row';

    // Add Script button
    const addScriptBtn = document.createElement('button');
    addScriptBtn.type = 'button';
    addScriptBtn.className = 'script-add-btn';
    addScriptBtn.appendChild(createIcon('plus', 16));
    const addText = document.createElement('span');
    addText.textContent = 'Add Script';
    addScriptBtn.appendChild(addText);
    addScriptBtn.addEventListener('click', () => {
      state.scripts.push({ name: '', enabled: true });
      scripts.setScripts(state.scripts);
      this.refresh();
      // Focus the new input after refresh
      this.setManagedTimeout(() => {
        const inputs = this.content.querySelectorAll('.script-item-name-input');
        const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
        lastInput?.focus();
      }, 50);
    }, { signal: this.refreshAbort!.signal });
    actionsRow.appendChild(addScriptBtn);

    // Link to Script Workbench for full editing
    const workbenchBtn = document.createElement('button');
    workbenchBtn.type = 'button';
    workbenchBtn.className = 'script-workbench-link-btn';
    workbenchBtn.appendChild(createIcon('edit', 14));
    const btnText = document.createElement('span');
    btnText.textContent = 'Edit in Script Workbench';
    workbenchBtn.appendChild(btnText);
    workbenchBtn.addEventListener('click', () => {
      this.config.onOpenScriptWorkbench?.();
    }, { signal: this.refreshAbort!.signal });
    actionsRow.appendChild(workbenchBtn);

    container.appendChild(actionsRow);

    return container;
  }

  /**
   * Sets up drag and drop for script reordering
   */
  private setupScriptDragAndDrop(list: HTMLElement, scripts: ScriptComponent, entity: Entity): void {
    let draggedIndex = -1;

    const items = list.querySelectorAll('.script-item');
    items.forEach((item) => {
      const row = item as HTMLElement;
      const handle = row.querySelector('.script-item-drag-handle') as HTMLElement;
      
      if (!handle) return;

      handle.addEventListener('dragstart', (e) => {
        draggedIndex = parseInt(row.dataset.index || '-1', 10);
        row.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', draggedIndex.toString());
        }
      }, { signal: this.refreshAbort!.signal });

      handle.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        items.forEach((i) => i.classList.remove('drag-over'));
        draggedIndex = -1;
      }, { signal: this.refreshAbort!.signal });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
      }, { signal: this.refreshAbort!.signal });

      row.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (draggedIndex !== -1) {
          row.classList.add('drag-over');
        }
      }, { signal: this.refreshAbort!.signal });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over');
      }, { signal: this.refreshAbort!.signal });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');

        const targetIndex = parseInt(row.dataset.index || '-1', 10);
        if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
          const state = scripts.toJSON();
          const [movedScript] = state.scripts.splice(draggedIndex, 1);
          if (movedScript) {
            state.scripts.splice(targetIndex, 0, movedScript);
            scripts.setScripts(state.scripts);
            this.config.onEntityRenamed(entity);
            this.refresh();
            this.announce('Script reordered');
          }
        }
      }, { signal: this.refreshAbort!.signal });
    });
  }

  private createScriptsEmptyState(entity: Entity): HTMLElement {
    const container = document.createElement('div');
    container.className = 'property-content scripts-empty-state';

    const text = document.createElement('p');
    text.className = 'muted-text';
    text.textContent = 'No ScriptComponent attached.';

    const buttonsRow = document.createElement('div');
    buttonsRow.className = 'scripts-empty-buttons';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'script-add-component-btn';
    addBtn.textContent = 'Add ScriptComponent';
    addBtn.addEventListener('click', () => {
      // Avoid duplicates if component was added in the meantime
      if (entity.getComponent(ScriptComponent)) {
        this.renderedEntityId = null; // Force full rebuild so Scripts UI appears
        this.refresh();
        return;
      }
      try {
        const comp = new ScriptComponent();
        entity.addComponent(comp);
      } catch {
        // Silently ignore add errors (e.g., already present due to race)
      }
      this.renderedEntityId = null; // Force full rebuild so Scripts UI appears
      this.refresh();
    }, { signal: this.refreshAbort!.signal });

    const workbenchBtn = document.createElement('button');
    workbenchBtn.type = 'button';
    workbenchBtn.className = 'script-workbench-link-btn';
    workbenchBtn.appendChild(createIcon('edit', 14));
    const btnText = document.createElement('span');
    btnText.textContent = 'Open Script Workbench';
    workbenchBtn.appendChild(btnText);
    workbenchBtn.addEventListener('click', () => {
      this.config.onOpenScriptWorkbench?.();
    }, { signal: this.refreshAbort!.signal });

    buttonsRow.appendChild(addBtn);
    buttonsRow.appendChild(workbenchBtn);

    container.appendChild(text);
    container.appendChild(buttonsRow);
    return container;
  }

  private createAnimationEmptyState(entity: Entity): HTMLElement {
    const container = document.createElement('div');
    container.className = 'animation-properties animation-empty-state';

    const text = document.createElement('p');
    text.className = 'muted-text';
    text.textContent = 'No AnimationComponent. Add one to manage clips and state machine.';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'animation-add-component-btn';
    addBtn.textContent = 'Add AnimationComponent';
    addBtn.addEventListener('click', () => {
      if (entity.getComponent(AnimationComponent)) {
        this.renderedEntityId = null;
        this.refresh();
        return;
      }
      try {
        entity.addComponent(new AnimationComponent());
      } catch {
        // ignore failures
      }
      this.renderedEntityId = null;
      this.refresh();
    }, { signal: this.refreshAbort!.signal });

    container.appendChild(text);
    container.appendChild(addBtn);
    return container;
  }

  // ========== V2 Enhanced Property Methods ==========

  // Removed: replaced by reusable VectorInput module

  /**
   * Creates an enhanced vector property with reset button.
   */
  // Removed: replaced by reusable VectorInput module

  /**
   * Creates an enhanced number property with optional unit suffix.
   */
  private createNumberPropertyV2(
    label: string,
    value: number,
    onCommit: (next: number) => void,
    unit = '',
    min?: number,
    max?: number,
    step = 1
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'property-row-v2';

    const labelEl = document.createElement('label');
    labelEl.className = 'property-label-v2';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'property-input-wrapper';

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'property-number-input';
    input.value = Number.isFinite(value) ? value.toString() : '0';
    input.setAttribute('data-field', label.toLowerCase() === 'field of view' ? 'camera-fov' : label.toLowerCase() === 'near plane' ? 'camera-near' : label.toLowerCase() === 'far plane' ? 'camera-far' : '');
    input.step = step.toString();
    if (min !== undefined) input.min = min.toString();
    if (max !== undefined) input.max = max.toString();

    input.addEventListener('change', () => {
      const parsed = Number.parseFloat(input.value);
      if (Number.isFinite(parsed)) {
        onCommit(parsed);
      }
    }, { signal: this.refreshAbort!.signal });

    this.addDebouncedInput(input, () => {
      const parsed = Number.parseFloat(input.value);
      if (Number.isFinite(parsed)) {
        onCommit(parsed);
      }
    }, 120);

    inputWrapper.appendChild(input);

    if (unit) {
      const unitLabel = document.createElement('span');
      unitLabel.className = 'property-unit-label';
      unitLabel.textContent = unit;
      inputWrapper.appendChild(unitLabel);
    }

    row.appendChild(inputWrapper);
    return row;
  }

  /**
   * Creates a modern toggle switch property.
   */
  private createTogglePropertyV2(
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'property-row-v2 property-row-toggle';

    const labelEl = document.createElement('label');
    labelEl.className = 'property-label-v2';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    // Modern toggle switch
    const toggleWrapper = document.createElement('label');
    toggleWrapper.className = 'toggle-switch';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.addEventListener('change', () => {
      onChange(checkbox.checked);
    }, { signal: this.refreshAbort!.signal });

    const slider = document.createElement('span');
    slider.className = 'toggle-slider';

    toggleWrapper.appendChild(checkbox);
    toggleWrapper.appendChild(slider);

    row.appendChild(toggleWrapper);
    return row;
  }

  /**
   * Creates an enhanced color property with modern picker.
   */
  // Removed: replaced by reusable ColorPicker module

  private handleScroll = () => {
    if (this.scrollRaf !== null) {
      return;
    }
    this.scrollRaf = window.requestAnimationFrame(() => {
      this.scrollRaf = null;
      this.updateActiveTabFromScroll();
      this.updateTabsSticky();
    });
  };

  private updateActiveTabFromScroll(): void {
    if (!this.sectionsWrapper) return;
    const contentRectTop = this.content.getBoundingClientRect().top;
    let bestSection: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const id of this.availableSections) {
      const section = this.sectionElements.get(id);
      if (!section) continue;
      const rect = section.getBoundingClientRect();
      const distance = Math.abs(rect.top - contentRectTop - 32);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSection = id;
      }
    }

    if (bestSection) {
      const current = this.getLayoutPrefs().activeSection;
      if (current !== bestSection) {
        this.setLayoutPrefs((prev) => ({
          ...prev,
          activeSection: bestSection,
        }));
        this.updateTabActiveState(bestSection);
      }
    }
  }

  private updateTabsSticky(): void {
    if (!this.sectionTabs) return;
    const header = this.root.querySelector('.inspector-header-v2');
    const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
    const tabsTop = this.sectionTabs.getBoundingClientRect().top;
    if (tabsTop <= headerBottom) {
      this.sectionTabs.classList.add('inspector-tabs-sticky');
    } else {
      this.sectionTabs.classList.remove('inspector-tabs-sticky');
    }
  }

  private getLayoutPrefs(): InspectorLayoutPreferences {
    if (this.config.state) {
      return this.config.state.inspectorLayout.value;
    }
    return this.fallbackInspectorLayout;
  }

  private setLayoutPrefs(update: InspectorLayoutPreferences | ((prev: InspectorLayoutPreferences) => InspectorLayoutPreferences)): void {
    if (this.config.state) {
      const prev = this.config.state.inspectorLayout.value;
      const next = typeof update === 'function' ? update(prev) : update;
      if (
        next.order !== prev.order ||
        next.collapsed !== prev.collapsed ||
        next.activeSection !== prev.activeSection
      ) {
        this.config.state.inspectorLayout.value = {
          order: [...next.order],
          collapsed: { ...next.collapsed },
          activeSection: next.activeSection,
        };
      }
      return;
    }

    const prev = this.fallbackInspectorLayout;
    const next = typeof update === 'function' ? update(prev) : update;
    this.fallbackInspectorLayout = {
      order: [...next.order],
      collapsed: { ...next.collapsed },
      activeSection: next.activeSection,
    };
  }

  private buildSections(entity: Entity): Array<{ id: string; element: HTMLElement }> {
    const built: Array<{ id: string; element: HTMLElement }> = [];
    const renderedIds: string[] = [];
    for (const sectionId of this.currentSectionOrder) {
      const element = this.createSectionForId(sectionId, entity);
      if (element) {
        built.push({ id: sectionId, element });
        renderedIds.push(sectionId);
      }
    }
    this.availableSections = renderedIds;
    if (renderedIds.length !== this.currentSectionOrder.length) {
      this.currentSectionOrder = renderedIds;
      this.setLayoutPrefs((prev) => ({
        ...prev,
        order: renderedIds,
      }));
    }
    return built;
  }

  private ensureActiveTab(): void {
    const prefs = this.getLayoutPrefs();
    const active = prefs.activeSection;
    const fallback = this.availableSections[0] ?? null;
    if (!active || !this.availableSections.includes(active)) {
      this.setLayoutPrefs((prev) => ({
        ...prev,
        activeSection: fallback,
      }));
      this.updateTabActiveState(fallback);
    } else {
      this.updateTabActiveState(active);
    }
  }

  private updateTabActiveState(activeId: string | null): void {
    for (const [id, button] of this.tabButtons.entries()) {
      const isActive = id === activeId;
      button.classList.toggle('inspector-tab-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.tabIndex = isActive ? 0 : -1;
    }
  }

  private renderTabs(sectionIds: string[]): HTMLElement {
    this.availableSections = sectionIds;

    const tabs = document.createElement('div');
    tabs.className = 'inspector-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.addEventListener('dragover', this.handleTabDragOver);
    tabs.addEventListener('drop', this.handleTabDrop);
    this.sectionTabs = tabs;

    const activeSection = this.getLayoutPrefs().activeSection;

    for (const sectionId of sectionIds) {
      const meta = SECTION_METADATA.find((entry) => entry.id === sectionId);
      if (!meta) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'inspector-tab';
      button.setAttribute('role', 'tab');
      button.setAttribute('data-section-id', sectionId);
      button.draggable = true;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'inspector-tab-icon';
      iconSpan.appendChild(createIcon(meta.icon, 14));
      const labelSpan = document.createElement('span');
      labelSpan.className = 'inspector-tab-label';
      labelSpan.textContent = meta.label;

      button.appendChild(iconSpan);
      button.appendChild(labelSpan);

      button.addEventListener('click', () => this.focusSection(sectionId));
      button.addEventListener('keydown', (event) => this.handleTabKeydown(event, sectionId));
      button.addEventListener('dragstart', (event) => this.handleTabDragStart(event, sectionId));
      button.addEventListener('dragend', this.handleTabDragEnd);

      this.tabButtons.set(sectionId, button);
      tabs.appendChild(button);
    }

    this.updateTabActiveState(activeSection);

    return tabs;
  }

  

  private handleTabKeydown(event: KeyboardEvent, sectionId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.focusSection(sectionId);
      return;
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const currentIndex = this.availableSections.indexOf(sectionId);
    if (currentIndex === -1) return;
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + this.availableSections.length) % this.availableSections.length;
    const nextId = this.availableSections[nextIndex]!;
    const button = this.tabButtons.get(nextId);
    button?.focus();
    this.focusSection(nextId);
  }

  private handleTabDragStart(event: DragEvent, sectionId: string): void {
    this.draggingTabId = sectionId;
    event.dataTransfer?.setData('text/plain', sectionId);
    event.dataTransfer?.setDragImage?.(event.currentTarget as Element, 8, 8);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  private handleTabDragEnd = (): void => {
    this.draggingTabId = null;
    for (const button of this.tabButtons.values()) {
      button.classList.remove('inspector-tab-drop-before');
      button.classList.remove('inspector-tab-drop-after');
    }
  };

  private handleTabDragOver = (event: DragEvent): void => {
    if (!this.draggingTabId) return;
    event.preventDefault();
    const target = (event.target as HTMLElement).closest('.inspector-tab') as HTMLButtonElement | null;
    if (!target) return;
    const targetId = target.getAttribute('data-section-id');
    if (!targetId || targetId === this.draggingTabId) return;

    const targetRect = target.getBoundingClientRect();
    const offset = event.clientX - targetRect.left;
    const insertBefore = offset < targetRect.width / 2;

    for (const button of this.tabButtons.values()) {
      button.classList.remove('inspector-tab-drop-before');
      button.classList.remove('inspector-tab-drop-after');
    }

    target.classList.add(insertBefore ? 'inspector-tab-drop-before' : 'inspector-tab-drop-after');
    event.dataTransfer!.dropEffect = 'move';
  };

  private handleTabDrop = (event: DragEvent): void => {
    if (!this.draggingTabId) return;
    event.preventDefault();
    const target = (event.target as HTMLElement).closest('.inspector-tab') as HTMLButtonElement | null;
    if (!target) return;
    const targetId = target.getAttribute('data-section-id');
    if (!targetId || targetId === this.draggingTabId) {
      this.handleTabDragEnd();
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const insertBefore = event.clientX - targetRect.left < targetRect.width / 2;
    this.reorderSections(this.draggingTabId, targetId, insertBefore);
    this.handleTabDragEnd();
  };

  private reorderSections(sourceId: string, targetId: string, before: boolean): void {
    const order = [...this.currentSectionOrder];
    const sourceIndex = order.indexOf(sourceId);
    const targetIndex = order.indexOf(targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    order.splice(sourceIndex, 1);
    const nextIndex = order.indexOf(targetId);
    const insertIndex = before ? nextIndex : nextIndex + 1;
    order.splice(insertIndex, 0, sourceId);
    this.currentSectionOrder = order;
    this.setLayoutPrefs((prev) => ({
      ...prev,
      order,
    }));

    this.rerenderTabs();
    this.rebuildSectionOrder();
  }

  private rerenderTabs(): void {
    if (!this.sectionTabs || !this.sectionTabs.parentElement) return;
    const parent = this.sectionTabs.parentElement;
    const newTabs = this.renderTabs(this.availableSections);
    parent.replaceChild(newTabs, this.sectionTabs);
    this.updateTabActiveState(this.getLayoutPrefs().activeSection);
  }

  private rebuildSectionOrder(): void {
    if (!this.sectionsWrapper) return;
    for (const id of this.currentSectionOrder) {
      const element = this.sectionElements.get(id);
      if (element) {
        this.sectionsWrapper.appendChild(element);
      }
    }
  }

  private createSectionForId(id: string, entity: Entity): HTMLElement | null {
    const prefs = this.getLayoutPrefs();
    const collapsed = !!prefs.collapsed[id];

    switch (id) {
      case 'camera': {
        const cameraComponent = entity.getComponent(CameraComponent);
        if (!cameraComponent) return null;
        return this.createCollapsibleSection(
          'camera',
          'Camera',
          'camera',
          this.createCameraProperties(entity, cameraComponent),
          collapsed,
          () => this.toggleSectionCollapse('camera')
        );
      }
      case 'environment': {
        const environmentComponent = entity.getComponent(EnvironmentComponent);
        if (!environmentComponent) return null;
        return this.createCollapsibleSection(
          'environment',
          'Environment',
          'sun',
          this.createEnvironmentProperties(entity, environmentComponent),
          collapsed,
          () => this.toggleSectionCollapse('environment')
        );
      }
      case 'animation': {
        const animationComponent = entity.getComponent(AnimationComponent);
        const content = animationComponent
          ? createAnimationSection({
              entity,
              component: animationComponent,
              abortSignal: this.refreshAbort!.signal,
              onRequestRefresh: () => this.refresh(),
              setManagedTimeout: (fn, ms) => this.setManagedTimeout(fn, ms),
            })
          : this.createAnimationEmptyState(entity);
        return this.createCollapsibleSection(
          'animation',
          'Animation',
          'play-circle',
          content,
          collapsed,
          () => this.toggleSectionCollapse('animation')
        );
      }
      case 'transform': {
        return this.createCollapsibleSection(
          'transform',
          'Transform',
          'move',
          this.createTransformProperties(entity),
          collapsed,
          () => this.toggleSectionCollapse('transform')
        );
      }
      case 'appearance': {
        return this.createCollapsibleSection(
          'appearance',
          'Appearance',
          'palette',
          this.createAppearanceProperties(entity),
          collapsed,
          () => this.toggleSectionCollapse('appearance')
        );
      }
      case 'material': {
        const materialComponent = entity.getComponent(MaterialComponent);
        if (!materialComponent) return null;
        return this.createCollapsibleSection(
          'material',
          'Material',
          'palette',
          this.createMaterialProperties(materialComponent),
          collapsed,
          () => this.toggleSectionCollapse('material')
        );
      }
      case 'scripts': {
        const scriptComponent = entity.getComponent(ScriptComponent);
        const content = scriptComponent
          ? this.createScriptsProperties(entity, scriptComponent)
          : this.createScriptsEmptyState(entity);
        return this.createCollapsibleSection(
          'scripts',
          'Scripts',
          'code',
          content,
          collapsed,
          () => this.toggleSectionCollapse('scripts')
        );
      }
      default:
        return null;
    }
  }

  private toggleSectionCollapse(sectionId: string): void {
    this.setLayoutPrefs((prev) => {
      const collapsed = { ...prev.collapsed };
      collapsed[sectionId] = !collapsed[sectionId];
      return {
        ...prev,
        collapsed,
      };
    });
  }

  private focusSection(sectionId: string): void {
    const element = this.sectionElements.get(sectionId);
    if (!element) return;
    element.scrollIntoView({ block: 'start', behavior: 'smooth' });
    this.setLayoutPrefs((prev) => ({
      ...prev,
      activeSection: sectionId,
    }));
    this.updateTabActiveState(sectionId);
  }

  private createMaterialProperties(material: MaterialComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = 'property-content';

    // Material ID
    const matIdRow = document.createElement('div');
    matIdRow.className = 'property-row-v2';
    const matIdLabel = document.createElement('label');
    matIdLabel.className = 'property-label-v2';
    matIdLabel.textContent = 'Material ID';
    const matIdInput = document.createElement('input');
    matIdInput.type = 'number';
    matIdInput.className = 'property-number-input';
    matIdInput.min = '0';
    matIdInput.max = String(MaterialComponent.MAX_MATERIAL_ID);
    matIdInput.step = '1';
    matIdInput.value = String(material.materialId);
    matIdInput.addEventListener(
      'change',
      () => {
        const next = Number.parseInt(matIdInput.value, 10);
        if (!Number.isFinite(next)) return;
        const prev = material.materialId;
        material.materialId = next;
        this.registerUndo(() => {
          material.materialId = prev;
          this.refresh();
        });
        this.refresh();
      },
      { signal: this.refreshAbort!.signal }
    );
    matIdRow.appendChild(matIdLabel);
    matIdRow.appendChild(matIdInput);
    container.appendChild(matIdRow);

    // Metallic
    container.appendChild(
      this.createNumberPropertyV2(
        'Metallic',
        material.metallic,
        (value) => {
          if (!Number.isFinite(value)) return;
          const clamped = Math.max(0, Math.min(1, value));
          const prev = material.metallic;
          material.metallic = clamped;
          this.registerUndo(() => {
            material.metallic = prev;
            this.refresh();
          });
        },
        '',
        0,
        1,
        0.01
      )
    );

    // Roughness
    container.appendChild(
      this.createNumberPropertyV2(
        'Roughness',
        material.roughness,
        (value) => {
          if (!Number.isFinite(value)) return;
          const clamped = Math.max(0.04, Math.min(1, value));
          const prev = material.roughness;
          material.roughness = clamped;
          this.registerUndo(() => {
            material.roughness = prev;
            this.refresh();
          });
        },
        '',
        0.04,
        1,
        0.01
      )
    );

    return container;
  }
}
