/**
 * UIEditor - Visual drag-and-drop editor for UI elements
 */

import './UIEditor.css';
import type { Scene } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import type { Entity } from '@engine/world';
import { UICanvasComponent } from '@engine/world/components/UICanvasComponent';
import { UIElementComponent, type UIElementType } from '@engine/world/components/UIElementComponent';
import { UIEditorController } from '../controllers/UIEditorController';
import { UIElementProperties } from './UIElementProperties';
import { DisposableGroup } from '@engine/core/utils';

export interface UIEditorConfig {
  scene: Scene;
  selection: SelectionManager;
  onElementChanged?: (entity: Entity) => void;
}

/**
 * Main UI editor component
 */
export class UIEditor {
  private readonly scene: Scene;
  private readonly selection: SelectionManager;
  private readonly onElementChanged?: (entity: Entity) => void;
  private readonly disposables = new DisposableGroup();

  private container: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private canvasElement: HTMLElement | null = null;
  private componentList: HTMLElement | null = null;
  private propertiesContainer: HTMLElement | null = null;
  private controller: UIEditorController | null = null;
  private currentProperties: UIElementProperties | null = null;

  constructor(config: UIEditorConfig) {
    this.scene = config.scene;
    this.selection = config.selection;
    this.onElementChanged = config.onElementChanged;
  }

  /**
   * Mount editor to container
   */
  mount(container: HTMLElement): void {
    if (this.container) {
      this.dispose();
    }

    this.container = this.createContainer();
    container.appendChild(this.container);

    // Setup controller
    if (this.canvasElement) {
      this.controller = new UIEditorController({
        scene: this.scene,
        selection: this.selection,
        canvasElement: this.canvasElement,
        onElementChanged: (entity) => {
          this.onElementChanged?.(entity);
          this.updateProperties(entity);
        },
      });
      this.disposables.add(() => this.controller?.dispose());
    }

    // Initial render
    this.render();
  }

  /**
   * Unmount editor
   */
  unmount(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.canvasElement = null;
    this.componentList = null;
    this.propertiesContainer = null;
    this.controller = null;
    this.currentProperties = null;
  }

  /**
   * Open editor as modal overlay
   */
  open(): void {
    if (this.overlay) {
      // Already open
      return;
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'ui-editor-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    overlay.style.zIndex = '10000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    // Create modal panel
    const panel = document.createElement('div');
    panel.className = 'ui-editor-modal';
    panel.style.width = '95%';
    panel.style.height = '90%';
    panel.style.backgroundColor = '#1a1f35';
    panel.style.borderRadius = '8px';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';

    // Header
    const header = document.createElement('div');
    header.style.padding = '16px';
    header.style.borderBottom = '1px solid #2a2f45';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    const title = document.createElement('h2');
    title.textContent = 'UI Editor';
    title.style.margin = '0';
    title.style.color = '#ffffff';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#ffffff';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0 8px';
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Content area
    const content = document.createElement('div');
    content.style.flex = '1';
    content.style.overflow = 'hidden';
    panel.appendChild(content);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Mount editor to content area
    this.mount(content);

    // Store overlay reference
    this.overlay = overlay;

    // Close on escape
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', escapeHandler);
    this.disposables.add(() => {
      document.removeEventListener('keydown', escapeHandler);
    });
  }

  /**
   * Close editor modal
   */
  close(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.unmount();
      this.overlay.parentNode.removeChild(this.overlay);
      this.overlay = null;
      this.container = null;
    }
  }

  /**
   * Refresh editor (update visuals)
   */
  refresh(): void {
    if (!this.container) return;

    this.render();
    this.controller?.refreshVisuals();
  }

  /**
   * Create main container
   */
  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'ui-editor-container';

    // Toolbar
    const toolbar = this.createToolbar();
    container.appendChild(toolbar);

    // Main content area
    const content = document.createElement('div');
    content.style.display = 'flex';
    content.style.flex = '1';
    content.style.overflow = 'hidden';

    // Component list sidebar
    this.componentList = this.createComponentList();
    content.appendChild(this.componentList);

    // Canvas area
    const canvasArea = this.createCanvasArea();
    content.appendChild(canvasArea);

    // Properties sidebar
    const propertiesArea = this.createPropertiesArea();
    content.appendChild(propertiesArea);

    container.appendChild(content);

    return container;
  }

  /**
   * Create toolbar
   */
  private createToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'ui-editor-toolbar';

    // Ensure UI Canvas exists button
    const ensureCanvasBtn = document.createElement('button');
    ensureCanvasBtn.textContent = 'Ensure UI Canvas';
    ensureCanvasBtn.addEventListener('click', () => {
      this.ensureUICanvas();
    });
    toolbar.appendChild(ensureCanvasBtn);

    return toolbar;
  }

  /**
   * Create component list sidebar
   */
  private createComponentList(): HTMLElement {
    const list = document.createElement('div');
    list.className = 'ui-editor-component-list';

    const header = document.createElement('h3');
    header.textContent = 'Components';
    list.appendChild(header);

    const components = [
      { type: 'button', label: 'Button', icon: '🔘' },
      { type: 'text', label: 'Text', icon: '📝' },
      { type: 'image', label: 'Image', icon: '🖼️' },
      { type: 'slider', label: 'Slider', icon: '🎚️' },
      { type: 'progress', label: 'Progress', icon: '📊' },
      { type: 'input', label: 'Input', icon: '📝' },
    ];

    for (const comp of components) {
      const item = document.createElement('div');
      item.className = 'ui-editor-component-item';
      item.draggable = true;
      item.dataset.type = comp.type;

      item.innerHTML = `
        <span class="ui-editor-component-icon">${comp.icon}</span>
        <span>${comp.label}</span>
      `;

      item.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', comp.type);
          e.dataTransfer.effectAllowed = 'copy';
        }
      });

      item.addEventListener('click', () => {
        this.addElement(comp.type as UIElementType);
      });

      list.appendChild(item);
    }

    return list;
  }

  /**
   * Create canvas area
   */
  private createCanvasArea(): HTMLElement {
    const area = document.createElement('div');
    area.style.flex = '1';
    area.style.display = 'flex';
    area.style.flexDirection = 'column';

    this.canvasElement = document.createElement('div');
    this.canvasElement.className = 'ui-editor-canvas';

    // Setup drop zone
    this.canvasElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    this.canvasElement.addEventListener('dragenter', (e) => {
      e.preventDefault();
      this.canvasElement?.classList.add('drag-over');
    });

    this.canvasElement.addEventListener('dragleave', (e) => {
      e.preventDefault();
      // Only remove class if leaving the canvas itself
      if (e.target === this.canvasElement || (e.target as HTMLElement).classList.contains('ui-editor-canvas')) {
        this.canvasElement?.classList.remove('drag-over');
      }
    });

    this.canvasElement.addEventListener('drop', (e) => {
      e.preventDefault();
      this.canvasElement?.classList.remove('drag-over');
      
      const type = e.dataTransfer?.getData('text/plain');
      if (type) {
        const rect = this.canvasElement!.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        
        // Snap to grid (20px grid)
        const snapSize = 20;
        x = Math.round(x / snapSize) * snapSize;
        y = Math.round(y / snapSize) * snapSize;
        
        this.addElement(type as UIElementType, { x, y });
      }
    });

    area.appendChild(this.canvasElement);

    return area;
  }

  /**
   * Create properties area
   */
  private createPropertiesArea(): HTMLElement {
    const area = document.createElement('div');
    area.style.width = '300px';
    area.style.borderLeft = '1px solid rgba(255, 255, 255, 0.1)';
    area.style.background = 'rgba(18, 22, 35, 0.6)';
    area.style.overflowY = 'auto';
    area.style.padding = '12px';

    const header = document.createElement('h3');
    header.textContent = 'Properties';
    header.style.margin = '0 0 12px';
    area.appendChild(header);

    this.propertiesContainer = document.createElement('div');
    area.appendChild(this.propertiesContainer);

    return area;
  }

  /**
   * Render UI elements on canvas
   */
  private render(): void {
    if (!this.canvasElement || !this.controller) return;

    // Clear canvas (except preview layer)
    const existing = this.canvasElement.querySelectorAll('.ui-editor-element');
    for (const el of existing) {
      el.remove();
    }

    // Get all UI elements
    const elementEntities = this.scene.queryEntities(UIElementComponent);

    // Render each element
    for (const entity of elementEntities) {
      const component = entity.getComponent(UIElementComponent);
      if (!component) continue;

      const visual = this.controller.createElementVisual(entity, component);
      this.canvasElement.appendChild(visual);
    }

    // Update properties if something is selected
    const selected = this.selection.primarySelection;
    if (selected) {
      const component = selected.getComponent(UIElementComponent);
      if (component) {
        this.updateProperties(selected);
      }
    }
  }

  /**
   * Ensure UI Canvas exists
   */
  private ensureUICanvas(): void {
    const canvases = this.scene.queryEntities(UICanvasComponent);
    if (canvases.length === 0) {
      const canvasEntity = this.scene.createEntity('UI Canvas');
      canvasEntity.addComponent(new UICanvasComponent());
      this.refresh();
    }
  }

  /**
   * Add new UI element
   */
  private addElement(type: UIElementType, position?: { x: number; y: number }): void {
    // Ensure canvas exists
    this.ensureUICanvas();
    const canvases = this.scene.queryEntities(UICanvasComponent);
    if (canvases.length === 0) return;

    const canvasEntity = canvases[0]!;

    // Create entity for element
    const elementEntity = this.scene.createEntity(`UI ${type}`);
    canvasEntity.addChild(elementEntity);

    // Create component
    const component = new UIElementComponent(undefined, type);
    if (position) {
      component.position = { x: position.x, y: position.y };
    } else {
      // Center in canvas
      if (this.canvasElement) {
        const rect = this.canvasElement.getBoundingClientRect();
        component.position = {
          x: Math.round(rect.width / 2 - component.size.width / 2),
          y: Math.round(rect.height / 2 - component.size.height / 2),
        };
      }
    }

    // Set defaults based on type
    switch (type) {
      case 'button':
        component.buttonText = 'Button';
        component.size = { width: 120, height: 40 };
        break;
      case 'text':
        component.textContent = 'Text';
        component.fontSize = 16;
        component.color = '#ffffff';
        component.size = { width: 200, height: 30 };
        break;
      case 'image':
        component.size = { width: 100, height: 100 };
        break;
      case 'slider':
        component.minValue = 0;
        component.maxValue = 100;
        component.value = 50;
        component.step = 1;
        component.size = { width: 200, height: 20 };
        break;
      case 'progress':
        component.value = 0.5;
        component.size = { width: 200, height: 30 };
        break;
      case 'input':
        component.inputType = 'text';
        component.placeholder = 'Enter text...';
        component.size = { width: 200, height: 30 };
        break;
    }

    elementEntity.addComponent(component);

    // Select new element
    this.selection.select(elementEntity);
    this.controller?.selectElement(elementEntity);

    this.refresh();
  }

  /**
   * Update properties panel
   */
  private updateProperties(entity: Entity): void {
    if (!this.propertiesContainer) return;

    const component = entity.getComponent(UIElementComponent);
    if (!component) {
      this.propertiesContainer.innerHTML = '<p>Selected entity is not a UI element</p>';
      return;
    }

    // Remove old properties
    if (this.currentProperties) {
      const oldElement = this.currentProperties.element;
      if (oldElement.parentNode) {
        oldElement.parentNode.removeChild(oldElement);
      }
    }

    // Create new properties editor
    this.currentProperties = new UIElementProperties({
      entity,
      component,
      onUpdate: (updatedComponent) => {
        // Update visual
        if (this.controller) {
          const visual = this.canvasElement?.querySelector(
            `[data-entity-id="${entity.id}"]`
          ) as HTMLElement;
          if (visual) {
            this.controller.updateElementVisual(visual, updatedComponent);
          }
        }

        if (this.onElementChanged) {
          this.onElementChanged(entity);
        }
      },
    });

    this.propertiesContainer.appendChild(this.currentProperties.element);
  }

  /**
   * Dispose editor
   */
  dispose(): void {
    this.disposables.dispose();
    this.unmount();
  }
}

