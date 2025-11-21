/**
 * UIPanel - Sidebar panel for UI management
 */

import './ui-panel.css';
import type { Scene } from '@engine/world';
import type { Entity } from '@engine/world';
import { UICanvasComponent } from '@engine/world/components/UICanvasComponent';
import { UIElementComponent, type UIElementType } from '@engine/world/components/UIElementComponent';

export interface UIPanelConfig {
  scene: Scene;
  onElementSelect?: (entity: Entity) => void;
  onElementAdd?: (type: UIElementType) => void;
}

/**
 * Panel for managing UI elements in the scene
 */
export class UIPanel {
  private readonly scene: Scene;
  private readonly onElementSelect: ((entity: Entity) => void) | undefined;
  private readonly onElementAdd: ((type: UIElementType) => void) | undefined;
  private container: HTMLElement;
  private listContainer: HTMLElement | null = null;

  constructor(config: UIPanelConfig) {
    this.scene = config.scene;
    this.onElementSelect = config.onElementSelect;
    this.onElementAdd = config.onElementAdd;
    this.container = this.createContainer();
  }

  /**
   * Gets the panel element
   */
  get element(): HTMLElement {
    return this.container;
  }

  /**
   * Refreshes the panel content
   */
  refresh(): void {
    this.render();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'ui-panel';
    return container;
  }

  private render(): void {
    // Clear container
    this.container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'ui-panel-header';
    header.innerHTML = `
      <h3>UI Elements</h3>
      <div class="ui-panel-actions">
        <button class="ui-panel-add-btn" data-type="button" title="Add Button">Button</button>
        <button class="ui-panel-add-btn" data-type="text" title="Add Text">Text</button>
        <button class="ui-panel-add-btn" data-type="image" title="Add Image">Image</button>
        <button class="ui-panel-add-btn" data-type="slider" title="Add Slider">Slider</button>
        <button class="ui-panel-add-btn" data-type="progress" title="Add Progress Bar">Progress</button>
        <button class="ui-panel-add-btn" data-type="input" title="Add Input Field">Input</button>
      </div>
    `;

    // Setup add buttons
    for (const btn of header.querySelectorAll('.ui-panel-add-btn')) {
      btn.addEventListener('click', (e) => {
        const type = (e.target as HTMLElement).dataset.type as UIElementType;
        if (type && this.onElementAdd) {
          this.onElementAdd(type);
        }
      });
    }

    this.container.appendChild(header);

    // Get all UI canvases and elements
    const canvasEntities = this.scene.queryEntities(UICanvasComponent);
    const elementEntities = this.scene.queryEntities(UIElementComponent);

    // List container
    this.listContainer = document.createElement('div');
    this.listContainer.className = 'ui-panel-list';

    if (canvasEntities.length === 0 && elementEntities.length === 0) {
      this.renderEmptyState();
    } else {
      // Render canvases
      for (const canvasEntity of canvasEntities) {
        const canvasComponent = canvasEntity.getComponent(UICanvasComponent);
        if (!canvasComponent) continue;

        const canvasItem = this.createCanvasItem(canvasEntity, canvasComponent);
        this.listContainer.appendChild(canvasItem);

        // Render elements under this canvas
        const childElements = this.findChildElements(canvasEntity, elementEntities);
        for (const elementEntity of childElements) {
          const elementComponent = elementEntity.getComponent(UIElementComponent);
          if (!elementComponent) continue;

          const elementItem = this.createElementItem(elementEntity, elementComponent);
          this.listContainer.appendChild(elementItem);
        }
      }

      // Render orphaned elements (elements without canvas parent)
      const orphanedElements = elementEntities.filter(
        (entity) => !this.findParentCanvas(entity, canvasEntities)
      );
      for (const elementEntity of orphanedElements) {
        const elementComponent = elementEntity.getComponent(UIElementComponent);
        if (!elementComponent) continue;

        const elementItem = this.createElementItem(elementEntity, elementComponent);
        this.listContainer.appendChild(elementItem);
      }
    }

    this.container.appendChild(this.listContainer);
  }

  private renderEmptyState(): void {
    const empty = document.createElement('div');
    empty.className = 'ui-panel-empty';
    empty.innerHTML = `
      <div class="ui-panel-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 9h6M9 15h6"/>
        </svg>
      </div>
      <p>No UI elements</p>
      <p class="ui-panel-empty-hint">Use buttons above to add elements</p>
    `;
    if (this.listContainer) {
      this.listContainer.appendChild(empty);
    }
  }

  private createCanvasItem(entity: Entity, component: UICanvasComponent): HTMLElement {
    const item = document.createElement('div');
    item.className = 'ui-panel-item ui-panel-canvas';
    item.dataset.entityId = entity.id;
    item.innerHTML = `
      <div class="ui-panel-item-icon">📋</div>
      <div class="ui-panel-item-info">
        <div class="ui-panel-item-name">${entity.name || 'UI Canvas'}</div>
        <div class="ui-panel-item-meta">Canvas (z-index: ${component.zIndex})</div>
      </div>
    `;

    item.addEventListener('click', () => {
      if (this.onElementSelect) {
        this.onElementSelect(entity);
      }
    });

    return item;
  }

  private createElementItem(entity: Entity, component: UIElementComponent): HTMLElement {
    const item = document.createElement('div');
    item.className = 'ui-panel-item ui-panel-element';
    item.dataset.entityId = entity.id;
    item.dataset.elementId = component.elementId;

    const iconMap: Record<string, string> = {
      button: '🔘',
      text: '📝',
      image: '🖼️',
      slider: '🎚️',
      progress: '📊',
      input: '📝',
    };
    const icon = iconMap[component.type] || '📦';
    const typeLabel = component.type.charAt(0).toUpperCase() + component.type.slice(1);

    item.innerHTML = `
      <div class="ui-panel-item-icon">${icon}</div>
      <div class="ui-panel-item-info">
        <div class="ui-panel-item-name">${component.elementId}</div>
        <div class="ui-panel-item-meta">${typeLabel} (${component.size.width}×${component.size.height})</div>
      </div>
      <div class="ui-panel-item-actions">
        <button class="ui-panel-delete-btn" title="Delete">×</button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('ui-panel-delete-btn')) {
        return; // Don't select when clicking delete
      }
      if (this.onElementSelect) {
        this.onElementSelect(entity);
      }
    });

    const deleteBtn = item.querySelector('.ui-panel-delete-btn') as HTMLButtonElement;
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        this.scene.removeEntity(entity);
        this.refresh();
      });
    }

    return item;
  }

  private findChildElements(canvasEntity: Entity, elementEntities: Entity[]): Entity[] {
    const children: Entity[] = [];
    for (const elementEntity of elementEntities) {
      if (elementEntity.parent === canvasEntity) {
        children.push(elementEntity);
      }
    }
    return children;
  }

  private findParentCanvas(elementEntity: Entity, canvasEntities: Entity[]): Entity | null {
    let current: Entity | null = elementEntity.parent;
    while (current) {
      if (canvasEntities.includes(current)) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.container.innerHTML = '';
  }
}

