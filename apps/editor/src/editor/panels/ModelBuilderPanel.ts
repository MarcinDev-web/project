/**
 * ModelBuilderPanel - UI panel for Model Builder
 * 
 * Tool selection, material picker, shape selector, operations
 */

import type { ModelBuilderMode } from '../model-builder/ModelBuilderMode';
import type { ModelBuilder } from '@engine/blocks';
import { getBlocksByCategory, getAllCategories } from '@engine/blocks';

/**
 * ModelBuilderPanel provides UI for model building tools
 */
export class ModelBuilderPanel {
  private readonly mode: ModelBuilderMode;
  private readonly builder: ModelBuilder;
  private panelElement: HTMLElement | null = null;

  constructor(mode: ModelBuilderMode, builder: ModelBuilder) {
    this.mode = mode;
    this.builder = builder;
  }

  /**
   * Creates panel UI element
   */
  createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'model-builder-panel';
    panel.innerHTML = this.getPanelHTML();
    
    this.attachEventListeners(panel);
    this.panelElement = panel;
    
    return panel;
  }

  /**
   * Gets panel HTML
   */
  private getPanelHTML(): string {
    return `
      <div class="model-builder-panel-content">
        <h3>Model Builder</h3>
        
        <div class="tool-section">
          <h4>Tools</h4>
          <div class="tool-buttons">
            <button data-tool="place" class="tool-btn active">Place</button>
            <button data-tool="remove" class="tool-btn">Remove</button>
            <button data-tool="paint" class="tool-btn">Paint</button>
            <button data-tool="select" class="tool-btn">Select</button>
          </div>
        </div>

        <div class="shape-section">
          <h4>Shape</h4>
          <select id="shape-selector">
            <option value="cube">Cube</option>
            <option value="slab">Slab</option>
            <option value="stairs">Stairs</option>
            <option value="corner">Corner</option>
            <option value="wedge">Wedge</option>
          </select>
        </div>

        <div class="material-section">
          <h4>Material</h4>
          <select id="material-selector">
            ${this.getMaterialOptions()}
          </select>
        </div>

        <div class="rotation-section">
          <h4>Rotation</h4>
          <button id="rotate-btn">Rotate (R)</button>
          <span id="rotation-display">0°</span>
        </div>

        <div class="operations-section">
          <h4>Operations</h4>
          <button id="fill-btn">Fill Region</button>
          <button id="clear-btn">Clear Region</button>
          <button id="mirror-x-btn">Mirror X</button>
          <button id="mirror-y-btn">Mirror Y</button>
          <button id="mirror-z-btn">Mirror Z</button>
        </div>

        <div class="export-section">
          <h4>Export</h4>
          <button id="export-btn">Export Model</button>
          <button id="import-btn">Import Model</button>
          <button id="save-block-btn">Save as Block</button>
        </div>

        <div class="info-section">
          <h4>Info</h4>
          <div id="block-count">Blocks: 0</div>
          <div id="bounds-info">Bounds: -</div>
        </div>
      </div>
    `;
  }

  /**
   * Gets material options HTML
   */
  private getMaterialOptions(): string {
    const categories = getAllCategories();
    let html = '';
    
    for (const category of categories) {
      const blocks = getBlocksByCategory(category);
      html += `<optgroup label="${category}">`;
      for (const block of blocks) {
        html += `<option value="${block.id}">${block.name}</option>`;
      }
      html += '</optgroup>';
    }
    
    return html;
  }

  /**
   * Attaches event listeners
   */
  private attachEventListeners(panel: HTMLElement): void {
    // Tool buttons
    const toolButtons = panel.querySelectorAll('[data-tool]');
    toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = (btn as HTMLElement).dataset.tool;
        if (tool) {
          this.mode.setToolMode(tool as 'place' | 'remove' | 'paint' | 'select');
          toolButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    });

    // Shape selector
    const shapeSelector = panel.querySelector('#shape-selector') as HTMLSelectElement;
    if (shapeSelector) {
      shapeSelector.addEventListener('change', (e) => {
        const shape = (e.target as HTMLSelectElement).value;
        this.mode.setBlockShape(shape as 'cube' | 'slab' | 'stairs' | 'corner' | 'wedge');
      });
    }

    // Material selector
    const materialSelector = panel.querySelector('#material-selector') as HTMLSelectElement;
    if (materialSelector) {
      materialSelector.addEventListener('change', (e) => {
        const materialId = (e.target as HTMLSelectElement).value;
        this.mode.setMaterialId(materialId);
      });
    }

    // Rotate button
    const rotateBtn = panel.querySelector('#rotate-btn');
    if (rotateBtn) {
      rotateBtn.addEventListener('click', () => {
        this.mode.rotateBlock();
        this.updateRotationDisplay(panel);
      });
    }

    // Operation buttons (placeholder - would need region selection)
    const fillBtn = panel.querySelector('#fill-btn');
    const clearBtn = panel.querySelector('#clear-btn');
    const mirrorXBtn = panel.querySelector('#mirror-x-btn');
    const mirrorYBtn = panel.querySelector('#mirror-y-btn');
    const mirrorZBtn = panel.querySelector('#mirror-z-btn');

    // Export buttons (placeholder)
    const exportBtn = panel.querySelector('#export-btn');
    const importBtn = panel.querySelector('#import-btn');
    const saveBlockBtn = panel.querySelector('#save-block-btn');
  }

  /**
   * Updates rotation display
   */
  private updateRotationDisplay(panel: HTMLElement): void {
    const toolState = this.mode.getToolState();
    const rotationDisplay = panel.querySelector('#rotation-display');
    if (rotationDisplay) {
      rotationDisplay.textContent = `${toolState.rotation * 90}°`;
    }
  }

  /**
   * Updates info display
   */
  updateInfo(): void {
    if (!this.panelElement) return;

    const blockCount = this.panelElement.querySelector('#block-count');
    if (blockCount) {
      blockCount.textContent = `Blocks: ${this.builder.getBlockCount()}`;
    }

    const bounds = this.builder.getBounds();
    const boundsInfo = this.panelElement.querySelector('#bounds-info');
    if (boundsInfo) {
      boundsInfo.textContent = `Bounds: [${bounds.min[0]},${bounds.min[1]},${bounds.min[2]}] to [${bounds.max[0]},${bounds.max[1]},${bounds.max[2]}]`;
    }
  }

  /**
   * Disposes panel
   */
  dispose(): void {
    if (this.panelElement) {
      this.panelElement.remove();
      this.panelElement = null;
    }
  }
}

