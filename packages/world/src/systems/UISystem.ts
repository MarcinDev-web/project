/**
 * UISystem - Renders UI components as HTML overlay in Play Mode
 */

import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import { UICanvasComponent } from '../components/UICanvasComponent.js';
import { UIElementComponent } from '../components/UIElementComponent.js';

/**
 * Configuration for UISystem
 */
export interface UISystemConfig {
  /** HTML container to mount UI into (defaults to document.body) */
  container?: HTMLElement;
}

/**
 * UISystem manages UI rendering as HTML overlay
 */
export class UISystem {
  private readonly scene: Scene;
  private readonly container: HTMLElement;
  private uiRoot: HTMLElement | null = null;
  private canvasElements = new Map<Entity, HTMLElement>();
  private elementElements = new Map<Entity, HTMLElement>();
  private clickHandlers = new Map<HTMLElement, () => void>();

  constructor(scene: Scene, config?: UISystemConfig) {
    this.scene = scene;
    this.container = config?.container || document.body;
  }

  /**
   * Initialize UI system (call when entering Play Mode)
   */
  initialize(): void {
    if (this.uiRoot) {
      this.cleanup();
    }

    this.uiRoot = document.createElement('div');
    this.uiRoot.id = 'game-ui-root';
    this.uiRoot.style.position = 'fixed';
    this.uiRoot.style.inset = '0';
    this.uiRoot.style.pointerEvents = 'none';
    this.uiRoot.style.zIndex = '1000';
    this.container.appendChild(this.uiRoot);

    this.update();
  }

  /**
   * Update UI system (call each frame in Play Mode)
   */
  update(): void {
    if (!this.uiRoot) return;

    // Get all canvas entities
    const canvasEntities = this.scene.queryEntities(UICanvasComponent);

    // Remove canvases that no longer exist
    for (const [entity] of this.canvasElements.entries()) {
      if (!canvasEntities.includes(entity)) {
        this.removeCanvas(entity);
      }
    }

    // Update or create canvases
    for (const canvasEntity of canvasEntities) {
      const canvasComponent = canvasEntity.getComponent(UICanvasComponent);
      if (!canvasComponent) continue;

      if (!canvasComponent.enabled) {
        const element = this.canvasElements.get(canvasEntity);
        if (element) {
          element.style.display = 'none';
        }
        continue;
      }

      let canvasElement = this.canvasElements.get(canvasEntity);
      if (!canvasElement) {
        canvasElement = this.createCanvasElement(canvasEntity, canvasComponent);
        this.canvasElements.set(canvasEntity, canvasElement);
        this.uiRoot.appendChild(canvasElement);
      }

      // Update canvas styles
      canvasElement.style.zIndex = String(canvasComponent.zIndex);
      if (canvasComponent.backgroundColor) {
        canvasElement.style.backgroundColor = canvasComponent.backgroundColor;
      }
      canvasElement.style.display = 'block';
    }

    // Get all UI element entities
    const elementEntities = this.scene.queryEntities(UIElementComponent);

    // Remove elements that no longer exist
    for (const [entity] of this.elementElements.entries()) {
      if (!elementEntities.includes(entity)) {
        this.removeElement(entity);
      }
    }

    // Update or create elements
    for (const elementEntity of elementEntities) {
      const elementComponent = elementEntity.getComponent(UIElementComponent);
      if (!elementComponent) continue;

      // Find parent canvas (entity should be child of canvas entity)
      const parentCanvas = this.findParentCanvas(elementEntity);
      if (!parentCanvas) continue; // Skip elements without canvas parent

      const canvasElement = this.canvasElements.get(parentCanvas);
      if (!canvasElement) continue;

      let uiElement = this.elementElements.get(elementEntity);
      if (!uiElement) {
        uiElement = this.createElementHTML(elementEntity, elementComponent);
        this.elementElements.set(elementEntity, uiElement);
        canvasElement.appendChild(uiElement);
      }

      this.updateElementHTML(uiElement, elementComponent);
    }
  }

  /**
   * Cleanup UI system (call when exiting Play Mode)
   */
  cleanup(): void {
    // Remove all click handlers
    // Handlers are already attached to elements, no need to manually remove
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _handler of this.clickHandlers.values()) {
      // Iterate to clear map
    }
    this.clickHandlers.clear();

    // Remove all elements
    for (const entity of this.elementElements.keys()) {
      this.removeElement(entity);
    }

    // Remove all canvases
    for (const entity of this.canvasElements.keys()) {
      this.removeCanvas(entity);
    }

    // Remove root
    if (this.uiRoot && this.uiRoot.parentNode) {
      this.uiRoot.parentNode.removeChild(this.uiRoot);
    }
    this.uiRoot = null;
  }

  /**
   * Dispose system resources
   */
  dispose(): void {
    this.cleanup();
  }

  /**
   * Find parent canvas entity for a UI element entity
   */
  private findParentCanvas(elementEntity: Entity): Entity | null {
    let current: Entity | null = elementEntity.parent;
    while (current) {
      if (current.getComponent(UICanvasComponent)) {
        return current;
      }
      current = current.parent;
    }
    // Fallback: check if any canvas exists and use first one
    const canvases = this.scene.queryEntities(UICanvasComponent);
    return canvases.length > 0 ? canvases[0]! : null;
  }

  /**
   * Create HTML element for canvas
   */
  private createCanvasElement(entity: Entity, _component: UICanvasComponent): HTMLElement {
    const element = document.createElement('div');
    element.className = 'game-ui-canvas';
    element.dataset.entityId = entity.id;
    element.style.position = 'absolute';
    element.style.inset = '0';
    element.style.pointerEvents = 'auto';
    return element;
  }

  /**
   * Remove canvas HTML element
   */
  private removeCanvas(entity: Entity): void {
    const element = this.canvasElements.get(entity);
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
    this.canvasElements.delete(entity);
  }

  /**
   * Create HTML element for UI element component
   */
  private createElementHTML(entity: Entity, component: UIElementComponent): HTMLElement {
    let element: HTMLElement;

    switch (component.type) {
      case 'button': {
        element = document.createElement('button');
        element.className = 'game-ui-button';
        (element as HTMLButtonElement).type = 'button';
        if (component.buttonText) {
          element.textContent = component.buttonText;
        }
        // Setup click handler
        const clickHandler = () => {
          if (component.enabled && component.visible) {
            this.scene.events.emit('ui:element:click', {
              elementId: component.elementId,
              entity,
              component,
            });
          }
        };
        element.addEventListener('click', clickHandler);
        this.clickHandlers.set(element, clickHandler);
        break;
      }

      case 'text':
        element = document.createElement('div');
        element.className = 'game-ui-text';
        if (component.textContent) {
          element.textContent = component.textContent;
        }
        break;

      case 'image':
        element = document.createElement('img');
        element.className = 'game-ui-image';
        if (component.imageUrl) {
          (element as HTMLImageElement).src = component.imageUrl;
        }
        (element as HTMLImageElement).alt = component.elementId;
        break;

      case 'slider': {
        element = document.createElement('input');
        element.className = 'game-ui-slider';
        (element as HTMLInputElement).type = 'range';
        (element as HTMLInputElement).min = String(component.minValue ?? 0);
        (element as HTMLInputElement).max = String(component.maxValue ?? 100);
        (element as HTMLInputElement).step = String(component.step ?? 1);
        (element as HTMLInputElement).value = String(component.value ?? component.minValue ?? 0);

        const sliderChangeHandler = () => {
          if (component.enabled && component.visible) {
            const newValue = parseFloat((element as HTMLInputElement).value);
            component.value = newValue;
            this.scene.events.emit('ui:element:change', {
              elementId: component.elementId,
              entity,
              component,
              value: newValue,
            });
          }
        };
        element.addEventListener('input', sliderChangeHandler);
        this.clickHandlers.set(element, sliderChangeHandler);
        break;
      }

      case 'progress': {
        element = document.createElement('div');
        element.className = 'game-ui-progress';

        const progressBar = document.createElement('div');
        progressBar.className = 'game-ui-progress-bar';
        progressBar.style.width = `${((component.value ?? 0) * 100).toFixed(1)}%`;
        element.appendChild(progressBar);

        const progressLabel = document.createElement('div');
        progressLabel.className = 'game-ui-progress-label';
        progressLabel.textContent = `${Math.round((component.value ?? 0) * 100)}%`;
        element.appendChild(progressLabel);
        break;
      }

      case 'input': {
        element = document.createElement('input');
        element.className = 'game-ui-input';
        (element as HTMLInputElement).type = component.inputType || 'text';
        (element as HTMLInputElement).placeholder = component.placeholder || '';
        if (component.inputType === 'number') {
          (element as HTMLInputElement).value = String(component.value ?? '');
          if (component.minValue !== undefined) {
            (element as HTMLInputElement).min = String(component.minValue);
          }
          if (component.maxValue !== undefined) {
            (element as HTMLInputElement).max = String(component.maxValue);
          }
          if (component.step !== undefined) {
            (element as HTMLInputElement).step = String(component.step);
          }
        } else {
          (element as HTMLInputElement).value = component.textContent || '';
        }

        const inputChangeHandler = () => {
          if (component.enabled && component.visible) {
            const inputValue = (element as HTMLInputElement).value;
            if (component.inputType === 'number') {
              component.value = parseFloat(inputValue) || 0;
            } else {
              component.textContent = inputValue;
            }
            this.scene.events.emit('ui:element:change', {
              elementId: component.elementId,
              entity,
              component,
              value: inputValue,
            });
          }
        };
        element.addEventListener('input', inputChangeHandler);
        element.addEventListener('change', inputChangeHandler);
        this.clickHandlers.set(element, inputChangeHandler);
        break;
      }

      default:
        element = document.createElement('div');
        element.className = 'game-ui-element';
    }

    element.dataset.elementId = component.elementId;
    element.dataset.entityId = entity.id;
    element.style.position = 'absolute';
    element.style.pointerEvents = 'auto';

    return element;
  }

  /**
   * Update HTML element based on component state
   */
  private updateElementHTML(element: HTMLElement, component: UIElementComponent): void {
    // Position and size
    element.style.left = `${component.position.x}px`;
    element.style.top = `${component.position.y}px`;
    element.style.width = `${component.size.width}px`;
    element.style.height = `${component.size.height}px`;

    // Visibility
    element.style.display = component.visible ? 'block' : 'none';

    // Enabled state (affects pointer events and opacity)
    if (component.type === 'button') {
      const button = element as HTMLButtonElement;
      button.disabled = !component.enabled;
      element.style.opacity = component.enabled ? '1' : '0.6';
      element.style.cursor = component.enabled ? 'pointer' : 'not-allowed';
    } else if (component.type === 'slider' || component.type === 'input') {
      (element as HTMLInputElement).disabled = !component.enabled;
      element.style.opacity = component.enabled ? '1' : '0.6';
      element.style.cursor = component.enabled ? 'default' : 'not-allowed';
    }

    // Type-specific updates
    switch (component.type) {
      case 'button':
        if (component.buttonText !== undefined) {
          element.textContent = component.buttonText;
        }
        break;

      case 'text':
        if (component.textContent !== undefined) {
          element.textContent = component.textContent;
        }
        if (component.color) {
          element.style.color = component.color;
        }
        if (component.backgroundColor) {
          element.style.backgroundColor = component.backgroundColor;
        }
        if (component.fontSize) {
          element.style.fontSize = `${component.fontSize}px`;
        }
        if (component.fontFamily) {
          element.style.fontFamily = component.fontFamily;
        }
        break;

      case 'image':
        if (component.imageUrl !== undefined) {
          (element as HTMLImageElement).src = component.imageUrl;
        }
        if (component.backgroundColor) {
          element.style.backgroundColor = component.backgroundColor;
        }
        break;

      case 'slider': {
        const slider = element as HTMLInputElement;
        if (typeof component.value === 'number') {
          slider.value = String(component.value);
        }
        if (typeof component.minValue === 'number') {
          slider.min = String(component.minValue);
        }
        if (typeof component.maxValue === 'number') {
          slider.max = String(component.maxValue);
        }
        if (typeof component.step === 'number') {
          slider.step = String(component.step);
        }
        if (component.color) {
          element.style.color = component.color;
        }
        if (component.backgroundColor) {
          element.style.backgroundColor = component.backgroundColor;
        }
        break;
      }

      case 'progress': {
        const progressBar = element.querySelector('.game-ui-progress-bar') as HTMLElement;
        const progressLabel = element.querySelector('.game-ui-progress-label') as HTMLElement;
        if (progressBar) {
          const progressValue = Math.max(0, Math.min(1, component.value ?? 0));
          progressBar.style.width = `${(progressValue * 100).toFixed(1)}%`;
        }
        if (progressLabel) {
          progressLabel.textContent = `${Math.round((component.value ?? 0) * 100)}%`;
        }
        if (component.color) {
          element.style.color = component.color;
        }
        if (component.backgroundColor) {
          element.style.backgroundColor = component.backgroundColor;
          if (progressBar) {
            progressBar.style.backgroundColor = component.backgroundColor;
          }
        }
        break;
      }

      case 'input': {
        const input = element as HTMLInputElement;
        if (component.inputType === 'number') {
          if (typeof component.value === 'number') {
            input.value = String(component.value);
          }
          if (typeof component.minValue === 'number') {
            input.min = String(component.minValue);
          }
          if (typeof component.maxValue === 'number') {
            input.max = String(component.maxValue);
          }
          if (typeof component.step === 'number') {
            input.step = String(component.step);
          }
        } else {
          if (component.textContent !== undefined) {
            input.value = component.textContent;
          }
        }
        if (component.placeholder !== undefined) {
          input.placeholder = component.placeholder;
        }
        if (component.color) {
          element.style.color = component.color;
        }
        if (component.backgroundColor) {
          element.style.backgroundColor = component.backgroundColor;
        }
        if (component.fontSize) {
          element.style.fontSize = `${component.fontSize}px`;
        }
        if (component.fontFamily) {
          element.style.fontFamily = component.fontFamily;
        }
        break;
    }
  }

  /**
   * Remove UI element HTML
   */
  private removeElement(entity: Entity): void {
    const element = this.elementElements.get(entity);
    if (element) {
      // Remove click handler if exists
      const handler = this.clickHandlers.get(element);
      if (handler) {
        element.removeEventListener('click', handler);
        this.clickHandlers.delete(element);
      }
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
    this.elementElements.delete(entity);
  }

  /**
   * Show/hide UI element by elementId (called from game logic)
   */
  showElement(elementId: string, show: boolean = true): boolean {
    for (const [entity, element] of this.elementElements.entries()) {
      const component = entity.getComponent(UIElementComponent);
      if (component && component.elementId === elementId) {
        component.visible = show;
        this.updateElementHTML(element, component);
        return true;
      }
    }
    return false;
  }

  /**
   * Set text of UI element by elementId
   */
  setElementText(elementId: string, text: string): boolean {
    for (const [entity, element] of this.elementElements.entries()) {
      const component = entity.getComponent(UIElementComponent);
      if (component && component.elementId === elementId) {
        if (component.type === 'button') {
          component.buttonText = text;
        } else if (component.type === 'text') {
          component.textContent = text;
        }
        this.updateElementHTML(element, component);
        return true;
      }
    }
    return false;
  }

  /**
   * Set image of UI element by elementId
   */
  setElementImage(elementId: string, imageUrl: string): boolean {
    for (const [entity, element] of this.elementElements.entries()) {
      const component = entity.getComponent(UIElementComponent);
      if (component && component.elementId === elementId && component.type === 'image') {
        component.imageUrl = imageUrl;
        this.updateElementHTML(element, component);
        return true;
      }
    }
    return false;
  }
}
