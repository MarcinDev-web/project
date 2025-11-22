/**
 * UIEditorController - Controls UI editor interactions (drag, drop, selection, resize)
 */

import type { Scene } from '@engine/world';
import type { Entity } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import { UIElementComponent } from '@engine/world';
import { HistoryManager } from '@engine/editor-utils';

export interface UIEditorControllerConfig {
  scene: Scene;
  selection: SelectionManager;
  history?: HistoryManager;
  canvasElement: HTMLElement;
  onElementChanged?: (entity: Entity) => void;
  snapSize?: number;
}

type ResizeHandleType = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type AlignmentMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/**
 * Controller for UI editor drag-and-drop, selection and resizing
 */
export class UIEditorController {
  private readonly scene: Scene;
  private readonly selection: SelectionManager;
  private readonly history: HistoryManager | undefined;
  private readonly canvasElement: HTMLElement;
  private readonly onElementChanged: ((entity: Entity) => void) | undefined;
  private snapSize: number;

  // Map entity ID to HTMLElement for synchronization
  private elements = new Map<string, HTMLElement>();

  // Bound event listeners for cleanup
  private readonly boundHandleMouseDown: (e: MouseEvent) => void;
  private readonly boundHandleMouseMove: (e: MouseEvent) => void;
  private readonly boundHandleMouseUp: () => void;
  private readonly boundHandleSelectionChange: (selected: ReadonlySet<Entity>) => void;
  private unsubscribeSelection: (() => void) | null = null;

  // State
  private draggedElement: HTMLElement | null = null;
  private dragStartMouse = { x: 0, y: 0 };
  private dragOffsets = new Map<string, { x: number, y: number }>(); // Initial positions for all selected entities
  
  private resizing = false;
  private resizeHandle: ResizeHandleType | null = null;
  private resizeTarget: Entity | null = null;
  private initialResizeState = { 
    x: 0, 
    y: 0, 
    width: 0, 
    height: 0, 
    startX: 0, 
    startY: 0 
  };

  constructor(config: UIEditorControllerConfig) {
    this.scene = config.scene;
    this.selection = config.selection;
    this.history = config.history;
    this.canvasElement = config.canvasElement;
    this.onElementChanged = config.onElementChanged;
    this.snapSize = config.snapSize ?? 20;

    // Bind event listeners once
    this.boundHandleMouseDown = this.handleMouseDown.bind(this);
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    this.boundHandleMouseUp = this.handleMouseUp.bind(this);
    this.boundHandleSelectionChange = this.handleSelectionChange.bind(this);

    this.setupCanvasListeners();
    this.setupSelectionListeners();
  }

  /**
   * Setup canvas event listeners
   */
  private setupCanvasListeners(): void {
    this.canvasElement.addEventListener('mousedown', this.boundHandleMouseDown);
    this.canvasElement.addEventListener('mousemove', this.boundHandleMouseMove);
    this.canvasElement.addEventListener('mouseup', this.boundHandleMouseUp);
  }

  /**
   * Setup selection listeners
   */
  private setupSelectionListeners(): void {
    this.unsubscribeSelection = this.selection.onSelectionChanged(this.boundHandleSelectionChange);
  }

  /**
   * Handle selection changes from SelectionManager
   */
  private handleSelectionChange(selectedEntities: ReadonlySet<Entity>): void {
    // Sync visual state for all elements
    for (const [id, element] of this.elements) {
      const isSelected = Array.from(selectedEntities).some(e => e.id === id);
      
      if (isSelected) {
        element.classList.add('selected');
        // Show handles only if it is the ONLY selected entity
        if (selectedEntities.size === 1) {
          // Ensure handles exist
          if (!element.querySelector('.ui-editor-resize-handle')) {
            this.createResizeHandles(element);
          }
        } else {
          // Remove handles if multiple selected
          this.removeResizeHandles(element);
        }
      } else {
        element.classList.remove('selected');
        this.removeResizeHandles(element);
      }
    }
  }

  /**
   * Create visual element on canvas for entity
   */
  createElementVisual(entity: Entity, component: UIElementComponent): HTMLElement {
    const element = document.createElement('div');
    element.className = 'ui-editor-element';
    element.dataset.entityId = entity.id;
    element.dataset.elementId = component.elementId;

    // Create content container to separate content from handles
    const content = document.createElement('div');
    content.className = 'ui-editor-content';
    content.style.width = '100%';
    content.style.height = '100%';
    content.style.overflow = 'hidden';
    content.style.pointerEvents = 'none'; // Allow clicks to pass through to element for dragging
    element.appendChild(content);

    // Store in map
    this.elements.set(entity.id, element);

    // Position and size
    this.updateElementVisual(element, component);

    // Make draggable
    element.addEventListener('mousedown', (e) => {
      // Ignore if clicking on a handle (handled separately)
      if ((e.target as HTMLElement).classList.contains('ui-editor-resize-handle')) {
        return;
      }
      
      e.stopPropagation();
      this.startDrag(element, entity, e);
    });

    // Make selectable
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectElement(entity, e.shiftKey || e.ctrlKey);
    });

    this.canvasElement.appendChild(element);
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
    
    // Set Z-index if available (though currently UIElementComponent doesn't have zIndex, 
    // we can assume DOM order or add it later. For now DOM order rules)
    // If we want to support Z-Index manipulation via simple DOM reordering:
    // We don't set z-index explicitly but rely on appendChild order.

    const content = element.querySelector('.ui-editor-content') as HTMLElement;
    if (!content) return;

    // Update content based on type
    switch (component.type) {
      case 'button':
        content.textContent = component.buttonText || 'Button';
        content.style.display = 'flex';
        content.style.alignItems = 'center';
        content.style.justifyContent = 'center';
        content.style.background = '#333';
        content.style.color = '#fff';
        content.style.borderRadius = '4px';
        break;
      case 'text':
        content.textContent = component.textContent || 'Text';
        content.style.display = 'block';
        content.style.background = 'transparent';
        content.style.color = '#fff';
        break;
      case 'image':
        content.innerHTML = component.imageUrl
          ? `<img src="${component.imageUrl}" alt="${component.elementId}" style="width: 100%; height: 100%; object-fit: contain;">`
          : 'Image';
        content.style.display = 'block';
        break;
      case 'slider':
        content.textContent = `🎚️ Slider (${component.value ?? component.minValue ?? 0})`;
        content.style.display = 'flex';
        content.style.alignItems = 'center';
        content.style.background = '#222';
        content.style.padding = '0 4px';
        break;
      case 'progress':
        content.textContent = `📊 Progress (${Math.round((component.value ?? 0) * 100)}%)`;
        content.style.display = 'flex';
        content.style.alignItems = 'center';
        content.style.background = '#222';
        break;
      case 'input':
        content.textContent = component.placeholder || '📝 Input';
        content.style.display = 'flex';
        content.style.alignItems = 'center';
        content.style.background = '#fff';
        content.style.color = '#000';
        content.style.padding = '0 4px';
        break;
      default:
        content.textContent = component.elementId;
    }
  }

  /**
   * Select an element
   */
  selectElement(entity: Entity, multiSelect: boolean = false): void {
    if (multiSelect) {
      this.selection.toggleSelection(entity);
    } else {
      if (!this.selection.isSelected(entity)) {
        this.selection.select(entity);
      }
    }
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selection.clearSelection();
  }

  /**
   * Align selected entities
   */
  alignSelected(mode: AlignmentMode): void {
    const selected = Array.from(this.selection.selectedEntities);
    if (selected.length < 2) return;

    const components = selected
      .map(e => ({ entity: e, component: e.getComponent(UIElementComponent) }))
      .filter(item => item.component !== undefined) as { entity: Entity, component: UIElementComponent }[];

    if (components.length < 2) return;

    // Determine target value
    let targetValue = 0;
    if (mode === 'left') {
      targetValue = Math.min(...components.map(c => c.component.position.x));
    } else if (mode === 'right') {
      targetValue = Math.max(...components.map(c => c.component.position.x + c.component.size.width));
    } else if (mode === 'top') {
      targetValue = Math.min(...components.map(c => c.component.position.y));
    } else if (mode === 'bottom') {
      targetValue = Math.max(...components.map(c => c.component.position.y + c.component.size.height));
    } else if (mode === 'center') {
      // Average center X
      const centerX = components.reduce((sum, c) => sum + c.component.position.x + c.component.size.width / 2, 0) / components.length;
      targetValue = centerX;
    } else if (mode === 'middle') {
      // Average center Y
      const centerY = components.reduce((sum, c) => sum + c.component.position.y + c.component.size.height / 2, 0) / components.length;
      targetValue = centerY;
    }

    let changed = false;

    // Apply alignment
    for (const { entity, component } of components) {
      const oldX = component.position.x;
      const oldY = component.position.y;

      switch (mode) {
        case 'left':
          component.position.x = targetValue;
          break;
        case 'right':
          component.position.x = targetValue - component.size.width;
          break;
        case 'top':
          component.position.y = targetValue;
          break;
        case 'bottom':
          component.position.y = targetValue - component.size.height;
          break;
        case 'center':
          component.position.x = targetValue - component.size.width / 2;
          break;
        case 'middle':
          component.position.y = targetValue - component.size.height / 2;
          break;
      }

      // Snap to grid
      component.position.x = Math.round(component.position.x / this.snapSize) * this.snapSize;
      component.position.y = Math.round(component.position.y / this.snapSize) * this.snapSize;

      if (component.position.x !== oldX || component.position.y !== oldY) {
        changed = true;
        // Update visual
        const element = this.elements.get(entity.id);
        if (element) {
          this.updateElementVisual(element, component);
        }
        if (this.onElementChanged) {
          this.onElementChanged(entity);
        }
      }
    }

    if (changed) {
      this.captureSnapshot(`Align UI Elements (${mode})`);
    }
  }

  /**
   * Bring selected elements to front
   */
  bringToFront(): void {
    const selected = Array.from(this.selection.selectedEntities);
    if (selected.length === 0) return;

    // In DOM, last child is on top.
    // We need to move selected elements to the end of the container.
    // Note: This changes the visual order but not necessarily any stored "zIndex" property 
    // unless we add one to UIElementComponent. For now, visuals driven by DOM order.
    
    // To persist this, we might need to reorder entities in the scene or add a zIndex component.
    // Since UIElementComponent doesn't have zIndex, we assume Scene order matters or just DOM order for now.
    // Changing DOM order is purely visual if we assume re-render might reset it based on Entity query order.
    // However, queryEntities order is usually insertion order.
    // To make it persistent without zIndex, we'd need to detach and reattach entities in the scene (change parent child order).
    
    // For this implementation, let's assume we manipulate DOM for visual feedback 
    // and arguably should update Scene order if possible. 
    // But Scene graph order modification isn't exposed easily here without re-parenting.
    
    // Let's just move DOM nodes for now and assume we want visual effect.
    
    for (const entity of selected) {
      const element = this.elements.get(entity.id);
      if (element && this.canvasElement.contains(element)) {
        this.canvasElement.appendChild(element); // Moves to end (top)
      }
    }
    
    // Ideally we should capture this, but if it's not persisted in component data, Undo won't work for Z-order
    // unless we add zIndex to component.
  }

  /**
   * Send selected elements to back
   */
  sendToBack(): void {
    const selected = Array.from(this.selection.selectedEntities);
    if (selected.length === 0) return;

    // Move to beginning of container
    // We iterate in reverse to keep relative order of selected items if possible, or just loop.
    for (const entity of selected) {
        const element = this.elements.get(entity.id);
        if (element && this.canvasElement.contains(element)) {
            this.canvasElement.prepend(element); // Moves to start (bottom)
        }
    }
  }

  /**
   * Create resize handles for element
   */
  private createResizeHandles(element: HTMLElement): void {
    // Prevent duplicates
    if (element.querySelector('.ui-editor-resize-handle')) return;

    const handles: ResizeHandleType[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    
    handles.forEach(type => {
      const handle = document.createElement('div');
      handle.className = `ui-editor-resize-handle ${type}`;
      handle.dataset.handle = type;
      
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        // Find the entity associated with this element
        const entityId = element.dataset.entityId;
        if (entityId) {
            const entity = this.scene.findEntityById(entityId);
            if (entity) {
                this.startResize(e, type, entity);
            }
        }
      });
      
      element.appendChild(handle);
    });
  }

  /**
   * Remove resize handles from element
   */
  private removeResizeHandles(element: HTMLElement): void {
    const handles = element.querySelectorAll('.ui-editor-resize-handle');
    handles.forEach(handle => handle.remove());
  }

  /**
   * Helper to capture current state for undo history
   */
  private captureSnapshot(description: string): void {
    if (!this.history) return;
    
    // Dispatch a custom event that the Editor (which has the serializer) can listen to
    const event = new CustomEvent('editor:history:push', {
      detail: { description }
    });
    window.dispatchEvent(event);
  }

  /**
   * Start dragging element(s)
   */
  private startDrag(element: HTMLElement, entity: Entity, e: MouseEvent): void {
    const component = entity.getComponent(UIElementComponent);
    if (!component) return;

    // Update selection if needed
    if (!this.selection.isSelected(entity)) {
      if (e.shiftKey || e.ctrlKey) {
        this.selection.addToSelection(entity);
      } else {
        this.selection.select(entity);
      }
    }

    this.draggedElement = element;
    this.dragStartMouse = { x: e.clientX, y: e.clientY };
    this.dragOffsets.clear();
    
    // Store initial positions for all selected entities
    for (const selectedEntity of this.selection.selectedEntities) {
      const comp = selectedEntity.getComponent(UIElementComponent);
      if (comp) {
        this.dragOffsets.set(selectedEntity.id, { x: comp.position.x, y: comp.position.y });
        
        // Visual feedback
        const el = this.elements.get(selectedEntity.id);
        if (el) el.classList.add('dragging');
      }
    }

    e.preventDefault();
  }

  /**
   * Start resizing element
   */
  private startResize(e: MouseEvent, handle: ResizeHandleType, entity: Entity): void {
    const component = entity.getComponent(UIElementComponent);
    if (!component) return;

    this.resizing = true;
    this.resizeHandle = handle;
    this.resizeTarget = entity;
    
    this.initialResizeState = {
      x: component.position.x,
      y: component.position.y,
      width: component.size.width,
      height: component.size.height,
      startX: e.clientX,
      startY: e.clientY
    };

    e.preventDefault();
  }

  /**
   * Handle mouse move
   */
  private handleMouseMove(e: MouseEvent): void {
    if (this.resizing) {
      this.handleResizeMove(e);
      return;
    }

    if (this.draggedElement) {
        this.handleDragMove(e);
    }
  }

  /**
   * Handle resizing movement
   */
  private handleResizeMove(e: MouseEvent): void {
    if (!this.resizeTarget || !this.resizeHandle) return;

    const component = this.resizeTarget.getComponent(UIElementComponent);
    if (!component) return;

    const dx = e.clientX - this.initialResizeState.startX;
    const dy = e.clientY - this.initialResizeState.startY;

    let newX = this.initialResizeState.x;
    let newY = this.initialResizeState.y;
    let newWidth = this.initialResizeState.width;
    let newHeight = this.initialResizeState.height;

    // Calculate new dimensions based on handle type
    if (this.resizeHandle.includes('e')) {
      newWidth = Math.max(this.snapSize, this.initialResizeState.width + dx);
    }
    if (this.resizeHandle.includes('w')) {
      const potentialWidth = Math.max(this.snapSize, this.initialResizeState.width - dx);
      const widthDiff = potentialWidth - this.initialResizeState.width;
      if (widthDiff !== 0) {
         newWidth = potentialWidth;
         newX = this.initialResizeState.x + (this.initialResizeState.width - newWidth);
      }
    }
    if (this.resizeHandle.includes('s')) {
      newHeight = Math.max(this.snapSize, this.initialResizeState.height + dy);
    }
    if (this.resizeHandle.includes('n')) {
      const potentialHeight = Math.max(this.snapSize, this.initialResizeState.height - dy);
      const heightDiff = potentialHeight - this.initialResizeState.height;
      if (heightDiff !== 0) {
        newHeight = potentialHeight;
        newY = this.initialResizeState.y + (this.initialResizeState.height - newHeight);
      }
    }

    // Snap to grid
    newX = Math.round(newX / this.snapSize) * this.snapSize;
    newY = Math.round(newY / this.snapSize) * this.snapSize;
    newWidth = Math.round(newWidth / this.snapSize) * this.snapSize;
    newHeight = Math.round(newHeight / this.snapSize) * this.snapSize;

    // Ensure minimum size
    newWidth = Math.max(this.snapSize, newWidth);
    newHeight = Math.max(this.snapSize, newHeight);

    // Update component
    component.position.x = newX;
    component.position.y = newY;
    component.size.width = newWidth;
    component.size.height = newHeight;

    // Update visual immediately
    const element = this.elements.get(this.resizeTarget.id);
    if (element) {
      this.updateElementVisual(element, component);
    }

    if (this.onElementChanged) {
      this.onElementChanged(this.resizeTarget);
    }
  }

  /**
   * Handle dragging movement for all selected entities
   */
  private handleDragMove(e: MouseEvent): void {
    const dx = e.clientX - this.dragStartMouse.x;
    const dy = e.clientY - this.dragStartMouse.y;

    for (const [id, initialPos] of this.dragOffsets) {
      const entity = this.scene.findEntityById(id);
      if (!entity) continue;

      const component = entity.getComponent(UIElementComponent);
      if (!component) continue;

      const rawX = initialPos.x + dx;
      const rawY = initialPos.y + dy;

      // Snap to grid
      const snappedX = Math.round(rawX / this.snapSize) * this.snapSize;
      const snappedY = Math.round(rawY / this.snapSize) * this.snapSize;

      // Update component
      component.position.x = snappedX;
      component.position.y = snappedY;

      // Update visual
      const element = this.elements.get(id);
      if (element) {
        element.style.left = `${snappedX}px`;
        element.style.top = `${snappedY}px`;
      }

      if (this.onElementChanged) {
        this.onElementChanged(entity);
      }
    }
  }

  /**
   * Handle mouse up (end drag/resize)
   */
  private handleMouseUp(): void {
    let changed = false;

    if (this.draggedElement) {
      // Check if position actually changed from start
      // We can verify against dragOffsets or just check if dx/dy was non-zero and large enough
      // For now, simplest is to just push snapshot if we had valid drag offsets
      if (this.dragOffsets.size > 0) {
        // Verify if any entity actually moved
        for (const [id, initialPos] of this.dragOffsets) {
           const entity = this.scene.findEntityById(id);
           if (entity) {
               const comp = entity.getComponent(UIElementComponent);
               if (comp && (comp.position.x !== initialPos.x || comp.position.y !== initialPos.y)) {
                   changed = true;
                   break;
               }
           }
        }
      }

      // Remove dragging class from all selected elements
      for (const id of this.dragOffsets.keys()) {
          const el = this.elements.get(id);
          if (el) el.classList.remove('dragging');
      }
      this.draggedElement = null;
      this.dragOffsets.clear();
      
      if (changed) {
          this.captureSnapshot('Move UI Elements');
      }
    }
    
    if (this.resizing) {
      // Check if size/pos changed
      if (this.resizeTarget) {
          const comp = this.resizeTarget.getComponent(UIElementComponent);
          if (comp) {
              const s = this.initialResizeState;
              if (comp.position.x !== s.x || comp.position.y !== s.y || 
                  comp.size.width !== s.width || comp.size.height !== s.height) {
                  changed = true;
              }
          }
      }

      this.resizing = false;
      this.resizeHandle = null;
      this.resizeTarget = null;

      if (changed) {
        this.captureSnapshot('Resize UI Element');
      }
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
   * Create/Update/Delete synchronization
   */
  refreshVisuals(): void {
    const elementEntities = this.scene.queryEntities(UIElementComponent);
    const currentEntityIds = new Set<string>();

    // Create or Update
    for (const entity of elementEntities) {
      const component = entity.getComponent(UIElementComponent);
      if (!component) continue;

      currentEntityIds.add(entity.id);

      let element = this.elements.get(entity.id);
      if (!element) {
        // Create new
        element = this.createElementVisual(entity, component);
      } else {
        // Update existing
        this.updateElementVisual(element, component);
      }
    }

    // Delete stale elements
    for (const [entityId, element] of this.elements.entries()) {
      if (!currentEntityIds.has(entityId)) {
        element.remove();
        this.elements.delete(entityId);
      }
    }
    
    // Re-sync selection visuals in case something changed
    this.handleSelectionChange(this.selection.selectedEntities);
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.canvasElement.removeEventListener('mousedown', this.boundHandleMouseDown);
    this.canvasElement.removeEventListener('mousemove', this.boundHandleMouseMove);
    this.canvasElement.removeEventListener('mouseup', this.boundHandleMouseUp);

    if (this.unsubscribeSelection) {
      this.unsubscribeSelection();
      this.unsubscribeSelection = null;
    }

    // Clean up all elements
    for (const element of this.elements.values()) {
        element.remove();
    }
    this.elements.clear();
  }
}
