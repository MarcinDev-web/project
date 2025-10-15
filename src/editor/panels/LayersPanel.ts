/**
 * LayersPanel - Layer management for organizing entities
 * 
 * Features:
 * - Create/delete/rename layers
 * - Assign entities to layers
 * - Show/hide layers
 * - Lock/unlock layers
 * - Layer filtering
 */

import type { Scene } from '../../scene';
import { createIcon } from '../utils/icons';
import { storageSave, storageLoad } from '../../utils/storage';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
  entityIds: Set<string>;
}

export interface LayersPanelConfig {
  scene: Scene;
  onLayerChanged?: () => void;
}

export class LayersPanel {
  private readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private layers: Map<string, Layer> = new Map();
  private activeLayerId: string | null = null;

  constructor(private readonly config: LayersPanelConfig) {
    this.root = document.createElement('section');
    this.root.className = 'layers-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'layers-panel-header';

    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.textContent = 'Layers';
    header.appendChild(title);

    // Add layer button
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-icon-sm btn-ghost';
    addBtn.title = 'Add layer';
    addBtn.appendChild(createIcon('plus', 16));
    addBtn.addEventListener('click', () => this.addLayer());
    header.appendChild(addBtn);

    this.root.appendChild(header);

    // List
    this.list = document.createElement('div');
    this.list.className = 'layers-list custom-scrollbar';
    this.root.appendChild(this.list);

    // Load saved layers
    this.loadLayers();

    // Create default layer if empty
    if (this.layers.size === 0) {
      this.addLayer('Default');
    }

    this.render();
  }

  /**
   * Adds a new layer
   */
  private addLayer(name?: string): void {
    const id = `layer_${Date.now()}`;
    const layerName = name || `Layer ${this.layers.size + 1}`;

    const layer: Layer = {
      id,
      name: layerName,
      visible: true,
      locked: false,
      color: this.generateLayerColor(),
      entityIds: new Set(),
    };

    this.layers.set(id, layer);
    
    if (!this.activeLayerId) {
      this.activeLayerId = id;
    }

    this.saveLayers();
    this.render();
    this.config.onLayerChanged?.();
  }

  /**
   * Deletes a layer
   */
  private deleteLayer(id: string): void {
    if (this.layers.size <= 1) {
      // Can't delete the last layer
      return;
    }

    this.layers.delete(id);
    
    if (this.activeLayerId === id) {
      this.activeLayerId = this.layers.keys().next().value ?? null;
    }

    this.saveLayers();
    this.render();
    this.config.onLayerChanged?.();
  }

  /**
   * Renames a layer
   */
  private renameLayer(id: string): void {
    const layer = this.layers.get(id);
    if (!layer) return;

    const newName = prompt('Enter new layer name:', layer.name);
    if (newName && newName.trim()) {
      layer.name = newName.trim();
      this.saveLayers();
      this.render();
    }
  }

  /**
   * Toggles layer visibility
   */
  private toggleVisibility(id: string): void {
    const layer = this.layers.get(id);
    if (!layer) return;

    layer.visible = !layer.visible;
    this.saveLayers();
    this.render();
    this.config.onLayerChanged?.();
  }

  /**
   * Toggles layer lock
   */
  private toggleLock(id: string): void {
    const layer = this.layers.get(id);
    if (!layer) return;

    layer.locked = !layer.locked;
    this.saveLayers();
    this.render();
    this.config.onLayerChanged?.();
  }

  /**
   * Sets active layer
   */
  private setActiveLayer(id: string): void {
    this.activeLayerId = id;
    this.saveLayers();
    this.render();
  }

  /**
   * Generates a random color for a new layer
   */
  private generateLayerColor(): string {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
      '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
    ];
    const index = Math.floor(Math.random() * colors.length);
    return colors[index] ?? '#3b82f6';
  }

  /**
   * Renders the layers list
   */
  private render(): void {
    this.list.innerHTML = '';

    if (this.layers.size === 0) {
      const empty = document.createElement('div');
      empty.className = 'inspector-empty';
      empty.innerHTML = `
        <div class="inspector-empty-icon">${createIcon('layers', 48).outerHTML}</div>
        <span>No layers</span>
        <span class="text-xs text-3">Click + to add a layer</span>
      `;
      this.list.appendChild(empty);
      return;
    }

    this.layers.forEach((layer) => {
      const item = document.createElement('div');
      item.className = 'layer-item';
      if (layer.id === this.activeLayerId) {
        item.classList.add('active');
      }

      // Color indicator
      const colorIndicator = document.createElement('div');
      colorIndicator.className = 'layer-color';
      colorIndicator.style.backgroundColor = layer.color;
      item.appendChild(colorIndicator);

      // Name (clickable to select)
      const nameBtn = document.createElement('button');
      nameBtn.type = 'button';
      nameBtn.className = 'layer-name';
      nameBtn.textContent = layer.name;
      nameBtn.addEventListener('click', () => this.setActiveLayer(layer.id));
      nameBtn.addEventListener('dblclick', () => this.renameLayer(layer.id));
      item.appendChild(nameBtn);

      // Entity count badge
      const badge = document.createElement('span');
      badge.className = 'layer-badge';
      badge.textContent = layer.entityIds.size.toString();
      item.appendChild(badge);

      // Controls
      const controls = document.createElement('div');
      controls.className = 'layer-controls';

      // Visibility toggle
      const visBtn = document.createElement('button');
      visBtn.type = 'button';
      visBtn.className = 'btn-icon-sm btn-ghost';
      visBtn.title = layer.visible ? 'Hide layer' : 'Show layer';
      visBtn.appendChild(createIcon(layer.visible ? 'eye' : 'eye-off', 14));
      visBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleVisibility(layer.id);
      });
      controls.appendChild(visBtn);

      // Lock toggle
      const lockBtn = document.createElement('button');
      lockBtn.type = 'button';
      lockBtn.className = 'btn-icon-sm btn-ghost';
      lockBtn.title = layer.locked ? 'Unlock layer' : 'Lock layer';
      lockBtn.appendChild(createIcon(layer.locked ? 'lock' : 'unlock', 14));
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleLock(layer.id);
      });
      controls.appendChild(lockBtn);

      // Delete button (only if not last layer)
      if (this.layers.size > 1) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-icon-sm btn-ghost';
        deleteBtn.title = 'Delete layer';
        deleteBtn.appendChild(createIcon('trash', 14));
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Delete layer "${layer.name}"?`)) {
            this.deleteLayer(layer.id);
          }
        });
        controls.appendChild(deleteBtn);
      }

      item.appendChild(controls);
      this.list.appendChild(item);
    });
  }

  /**
   * Saves layers to localStorage
   */
  private saveLayers(): void {
    const layersData = Array.from(this.layers.values()).map(layer => ({
      ...layer,
      entityIds: Array.from(layer.entityIds),
    }));
    storageSave('layers', { layers: layersData, activeLayerId: this.activeLayerId });
  }

  /**
   * Loads layers from localStorage
   */
  private loadLayers(): void {
    const data = storageLoad<{ layers: any[]; activeLayerId: string | null }>('layers');
    if (data && data.layers) {
      this.layers.clear();
      data.layers.forEach((layerData: any) => {
        this.layers.set(layerData.id, {
          ...layerData,
          entityIds: new Set(layerData.entityIds || []),
        });
      });
      this.activeLayerId = data.activeLayerId;
    }
  }

  /**
   * Gets the active layer
   */
  getActiveLayer(): Layer | null {
    return this.activeLayerId ? this.layers.get(this.activeLayerId) ?? null : null;
  }

  /**
   * Gets all layers
   */
  getLayers(): Layer[] {
    return Array.from(this.layers.values());
  }

  /**
   * Gets the root element
   */
  get element(): HTMLElement {
    return this.root;
  }

  /**
   * Mounts to a parent element
   */
  mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }
}

