/**
 * UIEditorController - Controls UI editor interactions (drag, drop, selection)
 */

import type { Scene } from '@engine/world';
import type { Entity } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import { UIElementComponent } from '@engine/world/components/UIElementComponent';

export interface UIEditorControllerConfig {
  scene: Scene;
  selection: SelectionManager;
  canvasElement: HTMLElement;
  onElementChanged?: (entity: Entity) => void;
}

/**
 * Controller for UI editor drag-and-drop and selection
 */
export class UIEditorController {
  private readonly scene: Scene;
  private readonly selection: SelectionManager;
  private readonly canvasElement: HTMLElement;
  private readonly onElementChanged: ((entity: Entity) => void) | undefined;

  private draggedElement: HTMLElement | null = null;
  private dragOffset = { x: 0, y: 0 };
  private selectedElement: Entity | null = null;

  constructor(config: UIEditorControllerConfig) {
    this.scene = config.scene;
    this.selection = config.selection;
    this.canvasElement = config.canvasElement;
    this.onElementChanged = config.onElementChanged;

    this.setupCanvasListeners();
  }

  /**
   * Setup canvas event listeners
   */
  private setupCanvasListeners(): void {
    this.canvasElement.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvasElement.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvasElement.addEventListener('mouseup', () => this.handleMouseUp());
  }

  /**
   * Create visual element on canvas for entity
   */
  createElementVisual(entity: Entity, component: UIElementComponent): HTMLElement {
    const element = document.createElement('div');
    element.className = 'ui-editor-element';
    element.dataset.entityId = entity.id;
    element.dataset.elementId = component.elementId;

    // Position and size
    this.updateElementVisual(element, component);

    // Make draggable
    element.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.startDrag(element, entity, e);
    });

    // Make selectable
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectElement(entity);
    });

    return element;
  }

  /**
   * Update visual element to match component
   */
  updateElementVisual(element: HTMLElement, component: UIElementComponent): void {
    element.style.left = `${component.position.x}px`;
    element.style.top = `${component.position.y}px`;
    element.style.width = `${component.size.width}px`;
    element.style.height = `${component.size.height}px`;

    // Update content based on type
    switch (component.type) {
      case 'button':
        element.textContent = component.buttonText || 'Button';
        break;
      case 'text':
        element.textContent = component.textContent || 'Text';
        break;
      case 'image':
        element.innerHTML = component.imageUrl
          ? `<img src="${component.imageUrl}" alt="${component.elementId}" style="width: 100%; height: 100%; object-fit: contain;">`
          : 'Image';
        break;
      case 'slider':
        element.textContent = `🎚️ Slider (${component.value ?? component.minValue ?? 0})`;
        break;
      case 'progress':
        element.textContent = `📊 Progress (${Math.round((component.value ?? 0) * 100)}%)`;
        break;
      case 'input':
        element.textContent = component.placeholder || '📝 Input';
        break;
      default:
        element.textContent = component.elementId;
    }
  }

  /**
   * Select an element
   */
  selectElement(entity: Entity): void {
    if (this.selectedElement === entity) return;

    // Clear previous selection
    if (this.selectedElement) {
      const prevElement = this.canvasElement.querySelector(
        `[data-entity-id="${this.selectedElement.id}"]`
      ) as HTMLElement;
      if (prevElement) {
        prevElement.classList.remove('selected');
      }
    }

    this.selectedElement = entity;
    this.selection.select(entity);

    // Add selected class
    const element = this.canvasElement.querySelector(
      `[data-entity-id="${entity.id}"]`
    ) as HTMLElement;
    if (element) {
      element.classList.add('selected');
    }

    if (this.onElementChanged) {
      this.onElementChanged(entity);
    }
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    if (this.selectedElement) {
      const element = this.canvasElement.querySelector(
        `[data-entity-id="${this.selectedElement.id}"]`
      ) as HTMLElement;
      if (element) {
        element.classList.remove('selected');
      }
    }
    this.selectedElement = null;
    this.selection.clearSelection();
  }

  /**
   * Start dragging element
   */
  private startDrag(element: HTMLElement, entity: Entity, e: MouseEvent): void {
    const component = entity.getComponent(UIElementComponent);
    if (!component) return;

    this.draggedElement = element;
    element.classList.add('dragging');

    const rect = element.getBoundingClientRect();

    this.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    // Select element if not already selected
    if (this.selectedElement !== entity) {
      this.selectElement(entity);
    }

    e.preventDefault();
  }

  /**
   * Handle mouse move during drag
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this.draggedElement) return;

    const canvasRect = this.canvasElement.getBoundingClientRect();
    const x = e.clientX - canvasRect.left - this.dragOffset.x;
    const y = e.clientY - canvasRect.top - this.dragOffset.y;

    // Snap to grid (20px grid)
    const snapSize = 20;
    const snappedX = Math.round(x / snapSize) * snapSize;
    const snappedY = Math.round(y / snapSize) * snapSize;

    // Update visual position
    this.draggedElement.style.left = `${snappedX}px`;
    this.draggedElement.style.top = `${snappedY}px`;

    // Update component
    const entityId = this.draggedElement.dataset.entityId;
    if (entityId) {
      const entity = this.scene.findEntityById(entityId);
      if (entity) {
        const component = entity.getComponent(UIElementComponent);
        if (component) {
          component.position.x = snappedX;
          component.position.y = snappedY;

          if (this.onElementChanged) {
            this.onElementChanged(entity);
          }
        }
      }
    }
  }

  /**
   * Handle mouse up (end drag)
   */
  private handleMouseUp(): void {
    if (this.draggedElement) {
      this.draggedElement.classList.remove('dragging');
      this.draggedElement = null;
    }
  }

  /**
   * Handle mouse down on canvas (deselect)
   */
  private handleMouseDown(e: MouseEvent): void {
    // If clicking on canvas (not on an element), deselect
    if (e.target === this.canvasElement || (e.target as HTMLElement).classList.contains('ui-editor-canvas')) {
      this.clearSelection();
    }
  }

  /**
   * Refresh all element visuals
   */
  refreshVisuals(): void {
    const elementEntities = this.scene.queryEntities(UIElementComponent);
    for (const entity of elementEntities) {
      const component = entity.getComponent(UIElementComponent);
      if (!component) continue;

      const element = this.canvasElement.querySelector(
        `[data-entity-id="${entity.id}"]`
      ) as HTMLElement;
      if (element) {
        this.updateElementVisual(element, component);
      }
    }
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.canvasElement.removeEventListener('mousedown', () => {});
    this.canvasElement.removeEventListener('mousemove', () => {});
    this.canvasElement.removeEventListener('mouseup', () => {});
  }
}

