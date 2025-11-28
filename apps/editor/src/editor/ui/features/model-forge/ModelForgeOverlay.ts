/**
 * ModelForgeOverlay - Main UI overlay for Model Forge mode
 * 
 * Provides tools panel, palette, and status bar for microblock model building
 */

import { effect } from '@preact/signals-core';
import type { EditorState } from '../../../core/state';
import type { ModelBuilderMode, ToolState } from '../../../model-builder/ModelBuilderMode';
import type { ModelBuilder } from '@engine/blocks';
import { DisposableGroup } from '@engine/core/utils';
import { createIcon } from '../../../utils/icons';
import { getAllCategories, getBlocksByCategory } from '@engine/blocks';

export interface ModelForgeOverlayConfig {
  state: EditorState;
  builderMode: ModelBuilderMode | null;
  builder: ModelBuilder | null;
  onClose: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onClear?: () => void;
}

/**
 * Model Forge UI Overlay
 */
export class ModelForgeOverlay {
  private readonly config: ModelForgeOverlayConfig;
  private readonly disposables = new DisposableGroup();
  
  private root: HTMLElement | null = null;
  private toolsPanel: HTMLElement | null = null;
  private palettePanel: HTMLElement | null = null;
  private statusBar: HTMLElement | null = null;
  private blockCountEl: HTMLElement | null = null;
  
  private currentTool: ToolState['mode'] = 'place';
  private currentMaterial: string = 'plastic_red';
  private currentShape: ToolState['shape'] = 'cube';
  private currentRotation: number = 0;

  constructor(config: ModelForgeOverlayConfig) {
    this.config = config;
  }

  /**
   * Mounts the overlay to the DOM
   */
  mount(container: HTMLElement): void {
    if (this.root) return;

    // Create root overlay
    this.root = document.createElement('div');
    this.root.className = 'model-forge-overlay';
    this.root.innerHTML = this.getStyles();

    // Create main container
    const mainContainer = document.createElement('div');
    mainContainer.className = 'mf-container';

    // Header bar
    const header = this.createHeader();
    mainContainer.appendChild(header);

    // Content area with panels
    const content = document.createElement('div');
    content.className = 'mf-content';

    // Left tools panel
    this.toolsPanel = this.createToolsPanel();
    content.appendChild(this.toolsPanel);

    // Right palette panel
    this.palettePanel = this.createPalettePanel();
    content.appendChild(this.palettePanel);

    mainContainer.appendChild(content);

    // Bottom status bar
    this.statusBar = this.createStatusBar();
    mainContainer.appendChild(this.statusBar);

    this.root.appendChild(mainContainer);
    container.appendChild(this.root);

    // Setup reactivity
    this.setupReactivity();

    // Update initial state
    this.updateToolState();
    this.updateBlockCount();
  }

  /**
   * Creates header bar with title and actions
   */
  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'mf-header';

    // Left: Back button and title
    const left = document.createElement('div');
    left.className = 'mf-header-left';

    const backBtn = document.createElement('button');
    backBtn.className = 'mf-btn mf-btn-icon';
    backBtn.title = 'Exit Model Forge';
    backBtn.appendChild(createIcon('back', 18));
    backBtn.addEventListener('click', () => this.config.onClose());

    const title = document.createElement('h2');
    title.className = 'mf-title';
    title.textContent = 'MODEL FORGE';

    left.appendChild(backBtn);
    left.appendChild(title);

    // Center: Undo/Redo
    const center = document.createElement('div');
    center.className = 'mf-header-center';

    const undoBtn = document.createElement('button');
    undoBtn.className = 'mf-btn mf-btn-icon';
    undoBtn.title = 'Undo (Ctrl+Z)';
    undoBtn.appendChild(createIcon('undo', 16));
    undoBtn.addEventListener('click', () => this.config.builderMode?.undo());

    const redoBtn = document.createElement('button');
    redoBtn.className = 'mf-btn mf-btn-icon';
    redoBtn.title = 'Redo (Ctrl+Y)';
    redoBtn.appendChild(createIcon('redo', 16));
    redoBtn.addEventListener('click', () => this.config.builderMode?.redo());

    center.appendChild(undoBtn);
    center.appendChild(redoBtn);

    // Right: Actions
    const right = document.createElement('div');
    right.className = 'mf-header-right';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'mf-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => this.config.onClear?.());

    const importBtn = document.createElement('button');
    importBtn.className = 'mf-btn';
    importBtn.textContent = 'Import';
    importBtn.addEventListener('click', () => this.config.onImport?.());

    const exportBtn = document.createElement('button');
    exportBtn.className = 'mf-btn mf-btn-primary';
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', () => this.config.onExport?.());

    right.appendChild(clearBtn);
    right.appendChild(importBtn);
    right.appendChild(exportBtn);

    header.appendChild(left);
    header.appendChild(center);
    header.appendChild(right);

    return header;
  }

  /**
   * Creates tools panel (left side)
   */
  private createToolsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'mf-panel mf-tools-panel';

    // Tools section
    const toolsSection = document.createElement('div');
    toolsSection.className = 'mf-section';

    const toolsTitle = document.createElement('div');
    toolsTitle.className = 'mf-section-title';
    toolsTitle.textContent = 'TOOLS';
    toolsSection.appendChild(toolsTitle);

    const tools: Array<{ id: ToolState['mode']; icon: string; label: string }> = [
      { id: 'place', icon: 'plus', label: 'Place' },
      { id: 'remove', icon: 'trash', label: 'Remove' },
      { id: 'paint', icon: 'edit', label: 'Paint' },
      { id: 'select', icon: 'cursor', label: 'Select' },
      { id: 'box', icon: 'box', label: 'Box' },
    ];

    const toolsGrid = document.createElement('div');
    toolsGrid.className = 'mf-tools-grid';

    tools.forEach(tool => {
      const btn = document.createElement('button');
      btn.className = 'mf-tool-btn';
      btn.dataset.tool = tool.id;
      btn.title = tool.label;

      const icon = createIcon(tool.icon as any, 20);
      const label = document.createElement('span');
      label.textContent = tool.label;

      btn.appendChild(icon);
      btn.appendChild(label);

      btn.addEventListener('click', () => this.selectTool(tool.id));
      toolsGrid.appendChild(btn);
    });

    toolsSection.appendChild(toolsGrid);
    panel.appendChild(toolsSection);

    // Shape section
    const shapeSection = document.createElement('div');
    shapeSection.className = 'mf-section';

    const shapeTitle = document.createElement('div');
    shapeTitle.className = 'mf-section-title';
    shapeTitle.textContent = 'SHAPE';
    shapeSection.appendChild(shapeTitle);

    const shapes: Array<{ id: ToolState['shape']; label: string }> = [
      { id: 'cube', label: '▢ Cube' },
      { id: 'slab', label: '▭ Slab' },
      { id: 'stairs', label: '⊿ Stairs' },
      { id: 'corner', label: '⌐ Corner' },
      { id: 'wedge', label: '◢ Wedge' },
    ];

    const shapeSelect = document.createElement('select');
    shapeSelect.className = 'mf-select';
    shapeSelect.id = 'mf-shape-select';

    shapes.forEach(shape => {
      const option = document.createElement('option');
      option.value = shape.id;
      option.textContent = shape.label;
      shapeSelect.appendChild(option);
    });

    shapeSelect.addEventListener('change', () => {
      this.currentShape = shapeSelect.value as ToolState['shape'];
      this.config.builderMode?.setBlockShape(this.currentShape);
    });

    shapeSection.appendChild(shapeSelect);
    panel.appendChild(shapeSection);

    // Rotation section
    const rotationSection = document.createElement('div');
    rotationSection.className = 'mf-section';

    const rotationTitle = document.createElement('div');
    rotationTitle.className = 'mf-section-title';
    rotationTitle.textContent = 'ROTATION';
    rotationSection.appendChild(rotationTitle);

    const rotationControls = document.createElement('div');
    rotationControls.className = 'mf-rotation-controls';

    const rotateBtn = document.createElement('button');
    rotateBtn.className = 'mf-btn';
    rotateBtn.textContent = 'Rotate (R)';
    rotateBtn.addEventListener('click', () => {
      this.config.builderMode?.rotateBlock();
      this.currentRotation = (this.currentRotation + 90) % 360;
      this.updateRotationDisplay();
    });

    const rotationDisplay = document.createElement('span');
    rotationDisplay.className = 'mf-rotation-display';
    rotationDisplay.id = 'mf-rotation-display';
    rotationDisplay.textContent = '0°';

    rotationControls.appendChild(rotateBtn);
    rotationControls.appendChild(rotationDisplay);
    rotationSection.appendChild(rotationControls);
    panel.appendChild(rotationSection);

    // Operations section
    const opsSection = document.createElement('div');
    opsSection.className = 'mf-section';

    const opsTitle = document.createElement('div');
    opsTitle.className = 'mf-section-title';
    opsTitle.textContent = 'SELECTION OPS';
    opsSection.appendChild(opsTitle);

    const fillBtn = document.createElement('button');
    fillBtn.className = 'mf-btn mf-btn-full';
    fillBtn.textContent = 'Fill Selection';
    fillBtn.addEventListener('click', () => this.config.builderMode?.fillSelection());

    const clearSelBtn = document.createElement('button');
    clearSelBtn.className = 'mf-btn mf-btn-full';
    clearSelBtn.textContent = 'Clear Selection';
    clearSelBtn.addEventListener('click', () => this.config.builderMode?.clearSelection());

    const mirrorLabel = document.createElement('div');
    mirrorLabel.className = 'mf-label';
    mirrorLabel.textContent = 'Mirror:';

    const mirrorBtns = document.createElement('div');
    mirrorBtns.className = 'mf-btn-group';

    ['X', 'Y', 'Z'].forEach(axis => {
      const btn = document.createElement('button');
      btn.className = 'mf-btn mf-btn-small';
      btn.textContent = axis;
      btn.addEventListener('click', () => {
        this.config.builderMode?.mirrorSelection(axis.toLowerCase() as 'x' | 'y' | 'z');
      });
      mirrorBtns.appendChild(btn);
    });

    opsSection.appendChild(fillBtn);
    opsSection.appendChild(clearSelBtn);
    opsSection.appendChild(mirrorLabel);
    opsSection.appendChild(mirrorBtns);
    panel.appendChild(opsSection);

    return panel;
  }

  /**
   * Creates palette panel (right side)
   */
  private createPalettePanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'mf-panel mf-palette-panel';

    const title = document.createElement('div');
    title.className = 'mf-section-title';
    title.textContent = 'MATERIALS';
    panel.appendChild(title);

    // Get all categories and blocks
    const categories = getAllCategories();

    categories.forEach(category => {
      const blocks = getBlocksByCategory(category);
      if (blocks.length === 0) return;

      const categoryEl = document.createElement('div');
      categoryEl.className = 'mf-category';

      const categoryTitle = document.createElement('div');
      categoryTitle.className = 'mf-category-title';
      categoryTitle.textContent = category.toUpperCase();
      categoryEl.appendChild(categoryTitle);

      const grid = document.createElement('div');
      grid.className = 'mf-material-grid';

      blocks.forEach(block => {
        const btn = document.createElement('button');
        btn.className = 'mf-material-btn';
        btn.dataset.material = block.id;
        btn.title = block.name;

        // Get color from block definition
        const color = block.textures.top?.color || [0.5, 0.5, 0.5, 1];
        btn.style.backgroundColor = `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${color[3]})`;

        btn.addEventListener('click', () => this.selectMaterial(block.id));
        grid.appendChild(btn);
      });

      categoryEl.appendChild(grid);
      panel.appendChild(categoryEl);
    });

    return panel;
  }

  /**
   * Creates status bar
   */
  private createStatusBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'mf-status-bar';

    // Build zone info
    const zoneInfo = document.createElement('span');
    const bounds = this.config.state.modelForgeBounds.value;
    const sizeX = bounds.max[0] - bounds.min[0];
    const sizeY = bounds.max[1] - bounds.min[1];
    const sizeZ = bounds.max[2] - bounds.min[2];
    zoneInfo.textContent = `Build Zone: ${sizeX}×${sizeY}×${sizeZ}`;

    // Block count
    this.blockCountEl = document.createElement('span');
    this.blockCountEl.textContent = 'Blocks: 0';

    // Shortcuts hint
    const shortcuts = document.createElement('span');
    shortcuts.className = 'mf-shortcuts';
    shortcuts.textContent = 'R: Rotate | Ctrl+Z: Undo | Ctrl+Y: Redo | ESC: Exit';

    bar.appendChild(zoneInfo);
    bar.appendChild(this.blockCountEl);
    bar.appendChild(shortcuts);

    return bar;
  }

  /**
   * Updates the rotation display
   */
  private updateRotationDisplay(): void {
    const display = document.getElementById('mf-rotation-display');
    if (display) {
      display.textContent = `${this.currentRotation}°`;
    }
  }

  /**
   * Selects a tool
   */
  private selectTool(tool: ToolState['mode']): void {
    this.currentTool = tool;
    this.config.builderMode?.setToolMode(tool);

    // Update UI
    const buttons = this.toolsPanel?.querySelectorAll('.mf-tool-btn');
    buttons?.forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.tool === tool);
    });
  }

  /**
   * Selects a material
   */
  private selectMaterial(materialId: string): void {
    this.currentMaterial = materialId;
    this.config.builderMode?.setMaterialId(materialId);

    // Update UI
    const buttons = this.palettePanel?.querySelectorAll('.mf-material-btn');
    buttons?.forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.material === materialId);
    });
  }

  /**
   * Updates tool state in UI
   */
  private updateToolState(): void {
    // Set initial tool as active
    this.selectTool('place');
    this.selectMaterial('plastic_red');
  }

  /**
   * Updates block count display
   */
  updateBlockCount(): void {
    if (this.blockCountEl && this.config.builder) {
      const count = this.config.builder.getBlockCount();
      this.blockCountEl.textContent = `Blocks: ${count}`;
    }
  }

  /**
   * Sets up reactive updates
   */
  private setupReactivity(): void {
    // React to model forge state changes
    const disposer = effect(() => {
      const active = this.config.state.modelForgeActive.value;
      if (this.root) {
        this.root.style.display = active ? 'block' : 'none';
      }
    });
    this.disposables.add(disposer);
  }

  /**
   * Returns CSS styles for the overlay
   */
  private getStyles(): string {
    return `
      <style>
        .model-forge-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 100;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }

        .mf-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          pointer-events: none;
        }

        /* Header */
        .mf-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background: linear-gradient(180deg, rgba(15, 15, 20, 0.95) 0%, rgba(15, 15, 20, 0.85) 100%);
          border-bottom: 1px solid rgba(0, 255, 136, 0.3);
          pointer-events: auto;
        }

        .mf-header-left,
        .mf-header-center,
        .mf-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .mf-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 3px;
          color: #00ff88;
          text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
        }

        /* Content */
        .mf-content {
          flex: 1;
          display: flex;
          justify-content: space-between;
          padding: 16px;
          pointer-events: none;
        }

        /* Panels */
        .mf-panel {
          background: rgba(15, 15, 20, 0.9);
          border: 1px solid rgba(0, 255, 136, 0.2);
          border-radius: 8px;
          padding: 12px;
          pointer-events: auto;
          backdrop-filter: blur(10px);
        }

        .mf-tools-panel {
          width: 180px;
        }

        .mf-palette-panel {
          width: 220px;
          max-height: calc(100vh - 200px);
          overflow-y: auto;
        }

        .mf-palette-panel::-webkit-scrollbar {
          width: 6px;
        }

        .mf-palette-panel::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
        }

        .mf-palette-panel::-webkit-scrollbar-thumb {
          background: rgba(0, 255, 136, 0.3);
          border-radius: 3px;
        }

        /* Sections */
        .mf-section {
          margin-bottom: 16px;
        }

        .mf-section-title {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 8px;
        }

        /* Tools grid */
        .mf-tools-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
        }

        .mf-tool-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 10px 6px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 10px;
        }

        .mf-tool-btn:hover {
          background: rgba(0, 255, 136, 0.1);
          border-color: rgba(0, 255, 136, 0.3);
        }

        .mf-tool-btn.active {
          background: rgba(0, 255, 136, 0.2);
          border-color: #00ff88;
          color: #00ff88;
        }

        /* Buttons */
        .mf-btn {
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
          font-size: 12px;
          font-family: inherit;
          transition: all 0.2s ease;
        }

        .mf-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .mf-btn-icon {
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mf-btn-primary {
          background: rgba(0, 255, 136, 0.2);
          border-color: #00ff88;
          color: #00ff88;
        }

        .mf-btn-primary:hover {
          background: rgba(0, 255, 136, 0.3);
        }

        .mf-btn-full {
          width: 100%;
          margin-bottom: 6px;
        }

        .mf-btn-small {
          padding: 6px 12px;
          font-size: 11px;
        }

        .mf-btn-group {
          display: flex;
          gap: 6px;
        }

        /* Select */
        .mf-select {
          width: 100%;
          padding: 8px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          color: #fff;
          font-size: 12px;
          font-family: inherit;
        }

        /* Rotation */
        .mf-rotation-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .mf-rotation-display {
          font-size: 14px;
          font-weight: 700;
          color: #00ff88;
        }

        /* Labels */
        .mf-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          margin: 8px 0 4px;
        }

        /* Material palette */
        .mf-category {
          margin-bottom: 12px;
        }

        .mf-category-title {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 1px;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 6px;
        }

        .mf-material-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 4px;
        }

        .mf-material-btn {
          aspect-ratio: 1;
          border: 2px solid transparent;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .mf-material-btn:hover {
          border-color: rgba(255, 255, 255, 0.5);
          transform: scale(1.1);
        }

        .mf-material-btn.active {
          border-color: #00ff88;
          box-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
        }

        /* Status bar */
        .mf-status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background: rgba(15, 15, 20, 0.95);
          border-top: 1px solid rgba(0, 255, 136, 0.2);
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
          pointer-events: auto;
        }

        .mf-shortcuts {
          color: rgba(255, 255, 255, 0.4);
        }
      </style>
    `;
  }

  /**
   * Unmounts and cleans up
   */
  dispose(): void {
    this.disposables.dispose();
    this.root?.remove();
    this.root = null;
    this.toolsPanel = null;
    this.palettePanel = null;
    this.statusBar = null;
  }
}

