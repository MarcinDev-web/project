import type { ModelBuilderMode } from '../../model-builder/ModelBuilderMode';
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
    
    // Open first section by default
    const firstSection = panel.querySelector('.accordion-section') as HTMLElement;
    if (firstSection) {
      this.toggleAccordion(firstSection);
    }
    
    return panel;
  }

  /**
   * Gets panel HTML
   */
  private getPanelHTML(): string {
    return `
      <style>
        .model-builder-panel {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 8px;
          background: var(--panel-bg, #2b2b2b);
          color: var(--text-color, #eee);
          height: 100%;
          overflow-y: auto;
        }
        
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 8px;
          border-bottom: 1px solid #444;
        }
        
        .history-controls {
          display: flex;
          gap: 4px;
        }
        
        .history-btn {
          background: #444;
          border: none;
          color: #eee;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .history-btn:hover {
          background: #555;
        }

        .accordion-section {
          border: 1px solid #444;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .accordion-header {
          background: #333;
          padding: 8px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          user-select: none;
        }
        
        .accordion-header:hover {
          background: #3a3a3a;
        }
        
        .accordion-content {
          display: none;
          padding: 8px;
          background: #2b2b2b;
          border-top: 1px solid #444;
        }
        
        .accordion-section.active .accordion-content {
          display: block;
        }

        .accordion-section.active .accordion-icon {
          transform: rotate(180deg);
        }
        
        .tool-buttons {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 4px;
          margin-bottom: 8px;
        }
        
        .tool-btn {
          padding: 6px;
          background: #444;
          border: none;
          color: #eee;
          border-radius: 4px;
          cursor: pointer;
          text-align: center;
        }
        
        .tool-btn.active {
          background: #3498db;
          color: white;
        }
        
        .material-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 4px;
          margin-top: 4px;
        }
        
        .material-btn {
          width: 100%;
          aspect-ratio: 1;
          border: 2px solid transparent;
          border-radius: 4px;
          cursor: pointer;
          position: relative;
        }
        
        .material-btn:hover {
          border-color: #aaa;
        }
        
        .material-btn.active {
          border-color: white;
          box-shadow: 0 0 4px rgba(0,0,0,0.5);
        }
        
        .full-width-btn {
          width: 100%;
          padding: 6px;
          background: #444;
          border: none;
          color: #eee;
          border-radius: 4px;
          cursor: pointer;
          margin-bottom: 4px;
        }
        
        .full-width-btn:hover {
          background: #555;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
          font-size: 0.9em;
          color: #ccc;
        }
        
        select {
            width: 100%;
            padding: 4px;
            background: #333;
            color: #eee;
            border: 1px solid #444;
            border-radius: 4px;
            margin-bottom: 8px;
        }
      </style>

      <div class="panel-header">
        <h3>Builder</h3>
        <div class="history-controls">
          <button id="undo-btn" class="history-btn" title="Undo (Ctrl+Z)">↩</button>
          <button id="redo-btn" class="history-btn" title="Redo (Ctrl+Y)">↪</button>
        </div>
      </div>
      
      ${this.getAccordionSection('tools', 'Tools', this.getToolsHTML())}
      ${this.getAccordionSection('palette', 'Palette', this.getPaletteHTML())}
      ${this.getAccordionSection('operations', 'Operations', this.getOperationsHTML())}
      ${this.getAccordionSection('file', 'File', this.getFileHTML())}
      ${this.getAccordionSection('info', 'Info', this.getInfoHTML())}
      
      <input type="file" id="import-input" style="display: none" accept=".json" />
    `;
  }

  private getAccordionSection(id: string, title: string, content: string): string {
    return `
      <div class="accordion-section" data-section="${id}">
        <div class="accordion-header">
          <span>${title}</span>
          <span class="accordion-icon">▼</span>
        </div>
        <div class="accordion-content">
          ${content}
        </div>
      </div>
    `;
  }

  private getToolsHTML(): string {
    return `
      <div class="tool-buttons">
        <button data-tool="place" class="tool-btn active">Place</button>
        <button data-tool="remove" class="tool-btn">Remove</button>
        <button data-tool="paint" class="tool-btn">Paint</button>
        <button data-tool="select" class="tool-btn">Select</button>
      </div>
      
      <div>Shape</div>
      <select id="shape-selector">
        <option value="cube">Cube</option>
        <option value="slab">Slab</option>
        <option value="stairs">Stairs</option>
        <option value="corner">Corner</option>
        <option value="wedge">Wedge</option>
      </select>
      
      <div>Rotation</div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button id="rotate-btn" class="full-width-btn" style="flex: 1;">Rotate (R)</button>
        <span id="rotation-display" style="width: 40px; text-align: center;">0°</span>
      </div>
    `;
  }

  private getPaletteHTML(): string {
    const categories = getAllCategories();
    let html = '';
    
    for (const category of categories) {
      const blocks = getBlocksByCategory(category);
      html += `<div style="margin-top: 8px; font-size: 0.9em; text-transform: uppercase; color: #888;">${category}</div>`;
      html += '<div class="material-grid">';
      
      for (const block of blocks) {
        // Extract color from textures (simplified)
        // textures.top.color is [r,g,b,a]
        const color = block.textures.top?.color || [0.5, 0.5, 0.5, 1];
        const rgba = `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${color[3]})`;
        
        html += `
          <button 
            class="material-btn ${block.id === 'plastic_red' ? 'active' : ''}" 
            data-material="${block.id}"
            title="${block.name}"
            style="background-color: ${rgba};"
          ></button>
        `;
      }
      html += '</div>';
    }
    
    return html;
  }

  private getOperationsHTML(): string {
    return `
      <button id="fill-btn" class="full-width-btn">Fill Selection</button>
      <button id="clear-btn" class="full-width-btn">Clear Selection</button>
      <div style="margin-top: 8px;">Mirror Selection</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px;">
        <button id="mirror-x-btn" class="full-width-btn">X</button>
        <button id="mirror-y-btn" class="full-width-btn">Y</button>
        <button id="mirror-z-btn" class="full-width-btn">Z</button>
      </div>
    `;
  }

  private getFileHTML(): string {
    return `
      <button id="export-btn" class="full-width-btn">Export Model (.json)</button>
      <button id="import-btn" class="full-width-btn">Import Model</button>
    `;
  }

  private getInfoHTML(): string {
    return `
      <div class="info-row">
        <span>Blocks:</span>
        <span id="block-count">0</span>
      </div>
      <div class="info-row">
        <span>Selection:</span>
        <span id="selection-info">-</span>
      </div>
      <div class="info-row">
        <span>Bounds:</span>
        <span id="bounds-info">-</span>
      </div>
    `;
  }

  private toggleAccordion(section: HTMLElement): void {
    section.classList.toggle('active');
  }

  /**
   * Attaches event listeners
   */
  private attachEventListeners(panel: HTMLElement): void {
    // Accordion
    panel.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.parentElement;
        if (section) this.toggleAccordion(section);
      });
    });

    // Tool buttons
    panel.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = (btn as HTMLElement).dataset.tool;
        if (tool) {
          this.mode.setToolMode(tool as 'place' | 'remove' | 'paint' | 'select');
          panel.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    });

    // Shape selector
    const shapeSelector = panel.querySelector('#shape-selector');
    if (shapeSelector) {
      shapeSelector.addEventListener('change', (e) => {
        const shape = (e.target as HTMLSelectElement).value;
        this.mode.setBlockShape(shape as any);
      });
    }

    // Material buttons
    panel.querySelectorAll('.material-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const materialId = (btn as HTMLElement).dataset.material;
        if (materialId) {
          this.mode.setMaterialId(materialId);
          panel.querySelectorAll('.material-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    });

    // Rotation
    const rotateBtn = panel.querySelector('#rotate-btn');
    if (rotateBtn) {
      rotateBtn.addEventListener('click', () => {
        this.mode.rotateBlock();
        this.updateRotationDisplay(panel);
      });
    }

    // Operations
    const bindOp = (id: string, handler: () => void) => {
      const btn = panel.querySelector(id);
      if (btn) btn.addEventListener('click', handler);
    };

    bindOp('#fill-btn', () => this.mode.fillSelection());
    bindOp('#clear-btn', () => this.mode.clearSelection());
    bindOp('#mirror-x-btn', () => this.mode.mirrorSelection('x'));
    bindOp('#mirror-y-btn', () => this.mode.mirrorSelection('y'));
    bindOp('#mirror-z-btn', () => this.mode.mirrorSelection('z'));

    // Undo/Redo
    bindOp('#undo-btn', () => this.mode.undo());
    bindOp('#redo-btn', () => this.mode.redo());

    // File Operations
    bindOp('#export-btn', () => this.handleExport());
    bindOp('#import-btn', () => {
      const input = panel.querySelector('#import-input') as HTMLInputElement;
      if (input) input.click();
    });

    const importInput = panel.querySelector('#import-input');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) this.handleImport(file);
      });
    }
  }

  private handleExport(): void {
    const data = this.builder.exportModel();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `model-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private handleImport(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const data = JSON.parse(json);
        this.builder.importModel(data);
      } catch (err) {
        console.error('Failed to import model:', err);
        alert('Failed to import model');
      }
    };
    reader.readAsText(file);
  }

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
      blockCount.textContent = `${this.builder.getBlockCount()}`;
    }

    const bounds = this.builder.getBounds();
    const boundsInfo = this.panelElement.querySelector('#bounds-info');
    if (boundsInfo) {
      boundsInfo.textContent = `[${bounds.min}] to [${bounds.max}]`;
    }
    
    const selectionInfo = this.panelElement.querySelector('#selection-info');
    if (selectionInfo) {
      const sel = this.mode.getSelectionBounds();
      selectionInfo.textContent = sel 
        ? `[${sel.min}] - [${sel.max}]` 
        : 'None';
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
