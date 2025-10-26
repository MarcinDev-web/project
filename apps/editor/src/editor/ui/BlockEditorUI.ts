/**
 * Block Editor UI - Custom block creation interface
 *
 * Allows users to create custom blocks with:
 * - Name, category, material selection
 * - Color pickers for each face
 * - Pattern selection
 * - Live preview
 * - Save/export functionality
 */

import type { BlockDefinition, BlockCategory, BlockMaterialType } from '@engine/gfx-webgpu/blocks/BlockLibrary';
import type { RgbaColor } from '../../utils/colors';
import type { CTMPattern } from '@engine/gfx-webgpu/textures/ConnectedTextures';
import { ProceduralTextureGenerator } from '@engine/gfx-webgpu/textures/ProceduralTextureGenerator';

export interface CustomBlockData {
  id: string;
  definition: BlockDefinition;
  createdAt: number;
}

export class BlockEditorUI {
  private modal: HTMLElement | null = null;
  private previewCanvas: HTMLCanvasElement | null = null;
  private previewCtx: CanvasRenderingContext2D | null = null;
  private textureGenerator: ProceduralTextureGenerator | null = null;

  // Current block being edited
  private currentBlock: Partial<BlockDefinition> = {
    id: '',
    name: '',
    category: 'basic',
    material: 'plastic',
    textures: {
      top: { color: [0.5, 0.5, 0.5, 1], pattern: 'smooth', brightness: 1.0 },
      bottom: { color: [0.5, 0.5, 0.5, 1], pattern: 'smooth', brightness: 0.8 },
      sides: { color: [0.5, 0.5, 0.5, 1], pattern: 'smooth', brightness: 0.9 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.5,
      metallic: 0,
    },
  };

  private onSaveCallback: ((block: BlockDefinition) => void) | null = null;

  constructor() {
    // Delay initialization of ProceduralTextureGenerator until show() is called
    // This allows tests to run in Node.js environment without Canvas
  }

  /**
   * Lazy initialization of texture generator
   */
  private ensureTextureGenerator(): ProceduralTextureGenerator {
    if (!this.textureGenerator) {
      this.textureGenerator = new ProceduralTextureGenerator(128);
    }
    return this.textureGenerator;
  }

  /**
   * Show block editor modal
   */
  public show(existingBlock?: BlockDefinition, onSave?: (block: BlockDefinition) => void): void {
    if (existingBlock) {
      this.currentBlock = { ...existingBlock };
    } else {
      this.resetToDefaults();
    }

    this.onSaveCallback = onSave || null;
    this.createModal();
    this.updatePreview();
  }

  /**
   * Hide and cleanup modal
   */
  public hide(): void {
    if (this.modal) {
      document.body.removeChild(this.modal);
      this.modal = null;
      this.previewCanvas = null;
      this.previewCtx = null;
    }
  }

  /**
   * Reset block to default values
   */
  private resetToDefaults(): void {
    this.currentBlock = {
      id: `custom_${Date.now()}`,
      name: 'Custom Block',
      category: 'basic',
      material: 'plastic',
      textures: {
        top: { color: [0.5, 0.5, 0.5, 1], pattern: 'smooth', brightness: 1.0 },
        bottom: { color: [0.5, 0.5, 0.5, 1], pattern: 'smooth', brightness: 0.8 },
        sides: { color: [0.5, 0.5, 0.5, 1], pattern: 'smooth', brightness: 0.9 },
      },
      properties: {
        solid: true,
        transparent: false,
        emissive: 0,
        roughness: 0.5,
        metallic: 0,
      },
    };
  }

  /**
   * Create modal dialog
   */
  private createModal(): void {
    // Modal overlay
    this.modal = document.createElement('div');
    Object.assign(this.modal.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '2000',
      backdropFilter: 'blur(8px)',
    } as CSSStyleDeclaration);

    // Dialog container
    const dialog = document.createElement('div');
    Object.assign(dialog.style, {
      background: 'rgba(7, 11, 20, 0.98)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '20px',
      padding: '2rem',
      maxWidth: '900px',
      width: '90%',
      maxHeight: '85vh',
      overflowY: 'auto',
      color: '#f5f5f5',
      fontFamily: 'Inter, system-ui, sans-serif',
      boxShadow: '0 30px 80px rgba(0, 0, 0, 0.6)',
    } as CSSStyleDeclaration);

    // Title
    const title = document.createElement('h2');
    title.textContent = '🎨 Custom Block Editor';
    Object.assign(title.style, {
      margin: '0 0 1.5rem 0',
      fontSize: '1.5rem',
      fontWeight: '600',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    } as Partial<CSSStyleDeclaration>);
    dialog.appendChild(title);

    // Layout: Left (form) + Right (preview)
    const layout = document.createElement('div');
    Object.assign(layout.style, {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '2rem',
    } as CSSStyleDeclaration);

    // Left column: Form
    const formColumn = document.createElement('div');
    this.createFormSection(formColumn);

    // Right column: Preview
    const previewColumn = document.createElement('div');
    this.createPreviewSection(previewColumn);

    layout.appendChild(formColumn);
    layout.appendChild(previewColumn);
    dialog.appendChild(layout);

    // Action buttons
    const actions = document.createElement('div');
    Object.assign(actions.style, {
      display: 'flex',
      gap: '1rem',
      marginTop: '2rem',
      justifyContent: 'flex-end',
    } as CSSStyleDeclaration);

    const btnSave = this.createButton('💾 Save Block', '#27c93f', () => this.saveBlock());
    const btnCancel = this.createButton('❌ Cancel', '#ff5f56', () => this.hide());

    actions.appendChild(btnCancel);
    actions.appendChild(btnSave);
    dialog.appendChild(actions);

    this.modal.appendChild(dialog);
    document.body.appendChild(this.modal);

    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });
  }

  /**
   * Create form section with inputs
   */
  private createFormSection(container: HTMLElement): void {
    const section = document.createElement('div');
    Object.assign(section.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
    } as CSSStyleDeclaration);

    // Basic Info
    section.appendChild(this.createSectionTitle('📋 Basic Info'));
    section.appendChild(
      this.createTextInput('Name', this.currentBlock.name || '', (value) => {
        this.currentBlock.name = value;
        this.currentBlock.id = value.toLowerCase().replace(/\s+/g, '_');
      })
    );

    section.appendChild(
      this.createDropdown(
        'Category',
        ['basic', 'natural', 'decorative', 'mechanical', 'glass', 'light'] as BlockCategory[],
        this.currentBlock.category || 'basic',
        (value) => {
          this.currentBlock.category = value as BlockCategory;
          this.updatePreview();
        }
      )
    );

    section.appendChild(
      this.createDropdown(
        'Material',
        ['solid', 'glass', 'metal', 'wood', 'stone', 'plastic', 'emissive'] as BlockMaterialType[],
        this.currentBlock.material || 'plastic',
        (value) => {
          this.currentBlock.material = value as BlockMaterialType;
          this.updatePreview();
        }
      )
    );

    // Textures
    section.appendChild(this.createSectionTitle('🎨 Textures'));

    const faces: Array<{ key: 'top' | 'bottom' | 'sides'; label: string }> = [
      { key: 'top', label: 'Top Face' },
      { key: 'bottom', label: 'Bottom Face' },
      { key: 'sides', label: 'Side Faces' },
    ];

    for (const face of faces) {
      section.appendChild(this.createFaceEditor(face.key, face.label));
    }

    // Properties
    section.appendChild(this.createSectionTitle('⚙️ Properties'));

    section.appendChild(
      this.createCheckbox(
        'Solid (Collision)',
        this.currentBlock.properties?.solid || false,
        (value) => {
          if (this.currentBlock.properties) {
            this.currentBlock.properties.solid = value;
          }
        }
      )
    );

    section.appendChild(
      this.createCheckbox(
        'Transparent',
        this.currentBlock.properties?.transparent || false,
        (value) => {
          if (this.currentBlock.properties) {
            this.currentBlock.properties.transparent = value;
            this.updatePreview();
          }
        }
      )
    );

    section.appendChild(
      this.createSlider(
        'Emissive',
        0,
        1,
        0.1,
        this.currentBlock.properties?.emissive || 0,
        (value) => {
          if (this.currentBlock.properties) {
            this.currentBlock.properties.emissive = value;
            this.updatePreview();
          }
        }
      )
    );

    section.appendChild(
      this.createSlider(
        'Roughness',
        0,
        1,
        0.05,
        this.currentBlock.properties?.roughness || 0.5,
        (value) => {
          if (this.currentBlock.properties) {
            this.currentBlock.properties.roughness = value;
          }
        }
      )
    );

    section.appendChild(
      this.createSlider(
        'Metallic',
        0,
        1,
        0.05,
        this.currentBlock.properties?.metallic || 0,
        (value) => {
          if (this.currentBlock.properties) {
            this.currentBlock.properties.metallic = value;
          }
        }
      )
    );

    // Connected Textures
    section.appendChild(this.createSectionTitle('🔗 Connected Textures'));

    section.appendChild(
      this.createCheckbox('Enable CTM', !!this.currentBlock.ctm, (value) => {
        if (value) {
          this.currentBlock.ctm = {
            pattern: 'horizontal',
            matchSameType: true,
            matchCategory: false,
          };
        } else {
          delete this.currentBlock.ctm;
        }
        // Show/hide CTM options
        const ctmOptions = container.querySelector('[data-ctm-options]') as HTMLElement;
        if (ctmOptions) {
          ctmOptions.style.display = value ? 'flex' : 'none';
        }
      })
    );

    // CTM Options (initially hidden if no CTM)
    const ctmOptions = document.createElement('div');
    ctmOptions.setAttribute('data-ctm-options', 'true');
    Object.assign(ctmOptions.style, {
      display: this.currentBlock.ctm ? 'flex' : 'none',
      flexDirection: 'column',
      gap: '0.75rem',
      paddingLeft: '1rem',
      borderLeft: '2px solid rgba(99, 102, 241, 0.3)',
    } as CSSStyleDeclaration);

    ctmOptions.appendChild(
      this.createDropdown(
        'CTM Pattern',
        ['none', 'horizontal', 'vertical', 'cross', 'pillar', 'random'] as CTMPattern[],
        this.currentBlock.ctm?.pattern || 'horizontal',
        (value) => {
          if (this.currentBlock.ctm) {
            this.currentBlock.ctm.pattern = value as CTMPattern;
          }
        }
      )
    );

    ctmOptions.appendChild(
      this.createCheckbox(
        'Match Same Type Only',
        this.currentBlock.ctm?.matchSameType ?? true,
        (value) => {
          if (this.currentBlock.ctm) {
            this.currentBlock.ctm.matchSameType = value;
          }
        }
      )
    );

    ctmOptions.appendChild(
      this.createCheckbox(
        'Match Category',
        this.currentBlock.ctm?.matchCategory ?? false,
        (value) => {
          if (this.currentBlock.ctm) {
            this.currentBlock.ctm.matchCategory = value;
          }
        }
      )
    );

    section.appendChild(ctmOptions);

    container.appendChild(section);
  }

  /**
   * Create face texture editor
   */
  private createFaceEditor(face: 'top' | 'bottom' | 'sides', label: string): HTMLElement {
    const container = document.createElement('div');
    Object.assign(container.style, {
      padding: '1rem',
      background: 'rgba(255, 255, 255, 0.03)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
    } as CSSStyleDeclaration);

    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    Object.assign(labelEl.style, {
      fontWeight: '500',
      marginBottom: '0.75rem',
      fontSize: '0.95rem',
    } as CSSStyleDeclaration);
    container.appendChild(labelEl);

    const faceData = this.currentBlock.textures?.[face];
    if (!faceData) return container;

    // Color picker
    const colorRow = document.createElement('div');
    Object.assign(colorRow.style, {
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center',
      marginBottom: '0.5rem',
    } as CSSStyleDeclaration);

    const colorLabel = document.createElement('span');
    colorLabel.textContent = 'Color:';
    Object.assign(colorLabel.style, {
      fontSize: '0.85rem',
      minWidth: '60px',
    } as CSSStyleDeclaration);

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = this.rgbaToHex(faceData.color);
    Object.assign(colorInput.style, {
      width: '60px',
      height: '35px',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
    } as CSSStyleDeclaration);
    colorInput.addEventListener('input', () => {
      const rgb = this.hexToRgba(colorInput.value);
      faceData.color = [rgb[0], rgb[1], rgb[2], faceData.color[3]];
      this.updatePreview();
    });

    const alphaLabel = document.createElement('span');
    alphaLabel.textContent = 'Alpha:';
    Object.assign(alphaLabel.style, {
      fontSize: '0.85rem',
      marginLeft: '0.5rem',
    } as CSSStyleDeclaration);

    const alphaInput = document.createElement('input');
    alphaInput.type = 'range';
    alphaInput.min = '0';
    alphaInput.max = '1';
    alphaInput.step = '0.01';
    alphaInput.value = String(faceData.color[3]);
    Object.assign(alphaInput.style, {
      flex: '1',
    } as CSSStyleDeclaration);
    alphaInput.addEventListener('input', () => {
      faceData.color[3] = Number.parseFloat(alphaInput.value);
      this.updatePreview();
    });

    colorRow.appendChild(colorLabel);
    colorRow.appendChild(colorInput);
    colorRow.appendChild(alphaLabel);
    colorRow.appendChild(alphaInput);
    container.appendChild(colorRow);

    // Pattern selector
    const patternRow = document.createElement('div');
    Object.assign(patternRow.style, {
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center',
      marginBottom: '0.5rem',
    } as CSSStyleDeclaration);

    const patternLabel = document.createElement('span');
    patternLabel.textContent = 'Pattern:';
    Object.assign(patternLabel.style, {
      fontSize: '0.85rem',
      minWidth: '60px',
    } as CSSStyleDeclaration);

    const patternSelect = document.createElement('select');
    Object.assign(patternSelect.style, {
      flex: '1',
      padding: '0.4rem 0.6rem',
      background: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '6px',
      color: '#f5f5f5',
      cursor: 'pointer',
    } as CSSStyleDeclaration);

    const patterns = ['solid', 'smooth', 'grid', 'noise', 'bricks', 'planks', 'cobble'];
    for (const pattern of patterns) {
      const option = document.createElement('option');
      option.value = pattern;
      option.textContent = pattern.charAt(0).toUpperCase() + pattern.slice(1);
      if (pattern === faceData.pattern) {
        option.selected = true;
      }
      patternSelect.appendChild(option);
    }

    patternSelect.addEventListener('change', () => {
      faceData.pattern = patternSelect.value as any;
      this.updatePreview();
    });

    patternRow.appendChild(patternLabel);
    patternRow.appendChild(patternSelect);
    container.appendChild(patternRow);

    // Brightness slider
    const brightnessRow = document.createElement('div');
    Object.assign(brightnessRow.style, {
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center',
    } as CSSStyleDeclaration);

    const brightnessLabel = document.createElement('span');
    brightnessLabel.textContent = 'Brightness:';
    Object.assign(brightnessLabel.style, {
      fontSize: '0.85rem',
      minWidth: '80px',
    } as CSSStyleDeclaration);

    const brightnessInput = document.createElement('input');
    brightnessInput.type = 'range';
    brightnessInput.min = '0.5';
    brightnessInput.max = '2';
    brightnessInput.step = '0.1';
    brightnessInput.value = String(faceData.brightness || 1.0);
    Object.assign(brightnessInput.style, {
      flex: '1',
    } as CSSStyleDeclaration);

    const brightnessValue = document.createElement('span');
    brightnessValue.textContent = brightnessInput.value;
    Object.assign(brightnessValue.style, {
      fontSize: '0.85rem',
      minWidth: '40px',
    } as CSSStyleDeclaration);

    brightnessInput.addEventListener('input', () => {
      faceData.brightness = Number.parseFloat(brightnessInput.value);
      brightnessValue.textContent = brightnessInput.value;
      this.updatePreview();
    });

    brightnessRow.appendChild(brightnessLabel);
    brightnessRow.appendChild(brightnessInput);
    brightnessRow.appendChild(brightnessValue);
    container.appendChild(brightnessRow);

    return container;
  }

  /**
   * Create preview section with live canvas
   */
  private createPreviewSection(container: HTMLElement): void {
    const section = document.createElement('div');
    Object.assign(section.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      position: 'sticky',
      top: '0',
    } as CSSStyleDeclaration);

    section.appendChild(this.createSectionTitle('👁️ Live Preview'));

    // Preview canvas
    this.previewCanvas = document.createElement('canvas');
    this.previewCanvas.width = 400;
    this.previewCanvas.height = 400;
    Object.assign(this.previewCanvas.style, {
      width: '100%',
      height: 'auto',
      border: '2px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      imageRendering: 'pixelated',
    } as CSSStyleDeclaration);

    const ctx = this.previewCanvas.getContext('2d');
    if (ctx) {
      this.previewCtx = ctx;
    }

    section.appendChild(this.previewCanvas);

    // Info panel
    const info = document.createElement('div');
    Object.assign(info.style, {
      padding: '1rem',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '10px',
      fontSize: '0.85rem',
      lineHeight: '1.6',
    } as CSSStyleDeclaration);

    info.innerHTML = `
      <div style="margin-bottom: 0.5rem;"><strong>💡 Tips:</strong></div>
      <div>• Use color picker to choose base colors</div>
      <div>• Try different patterns for variety</div>
      <div>• Adjust brightness for depth</div>
      <div>• Emissive blocks glow in the dark</div>
      <div>• Transparent blocks let light through</div>
    `;

    section.appendChild(info);
    container.appendChild(section);
  }

  /**
   * Update live preview
   */
  private updatePreview(): void {
    if (!this.previewCanvas || !this.previewCtx || !this.currentBlock.textures) {
      return;
    }

    const ctx = this.previewCtx;
    const canvas = this.previewCanvas;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw isometric cube
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const size = 120;

    // Generate textures
    const generator = this.ensureTextureGenerator();
    const topTexture = generator.generateTexture(this.currentBlock.textures.top);
    const sideTexture = this.currentBlock.textures.sides
      ? generator.generateTexture(this.currentBlock.textures.sides)
      : topTexture;

    // Draw top face (diamond)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - size);
    ctx.lineTo(centerX + size, centerY - size / 2);
    ctx.lineTo(centerX, centerY);
    ctx.lineTo(centerX - size, centerY - size / 2);
    ctx.closePath();
    ctx.clip();

    // Apply top texture
    this.drawTexture(ctx, topTexture, centerX - size, centerY - size, size * 2, size);
    ctx.restore();

    // Draw left face
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(centerX - size, centerY - size / 2);
    ctx.lineTo(centerX, centerY);
    ctx.lineTo(centerX, centerY + size);
    ctx.lineTo(centerX - size, centerY + size / 2);
    ctx.closePath();
    ctx.clip();

    // Apply side texture (darker)
    this.drawTexture(ctx, sideTexture, centerX - size, centerY - size / 2, size, size * 1.5, 0.7);
    ctx.restore();

    // Draw right face
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + size, centerY - size / 2);
    ctx.lineTo(centerX + size, centerY + size / 2);
    ctx.lineTo(centerX, centerY + size);
    ctx.closePath();
    ctx.clip();

    // Apply side texture (lighter)
    this.drawTexture(ctx, sideTexture, centerX, centerY - size / 2, size, size * 1.5, 0.85);
    ctx.restore();

    // Draw outlines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 2;

    // Top outline
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - size);
    ctx.lineTo(centerX + size, centerY - size / 2);
    ctx.lineTo(centerX, centerY);
    ctx.lineTo(centerX - size, centerY - size / 2);
    ctx.closePath();
    ctx.stroke();

    // Left outline
    ctx.beginPath();
    ctx.moveTo(centerX - size, centerY - size / 2);
    ctx.lineTo(centerX, centerY);
    ctx.lineTo(centerX, centerY + size);
    ctx.lineTo(centerX - size, centerY + size / 2);
    ctx.closePath();
    ctx.stroke();

    // Right outline
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + size, centerY - size / 2);
    ctx.lineTo(centerX + size, centerY + size / 2);
    ctx.lineTo(centerX, centerY + size);
    ctx.closePath();
    ctx.stroke();
  }

  /**
   * Draw texture to context
   */
  private drawTexture(
    ctx: CanvasRenderingContext2D,
    imageData: ImageData,
    x: number,
    y: number,
    w: number,
    h: number,
    brightness = 1.0
  ): void {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.putImageData(imageData, 0, 0);

    // Apply brightness
    if (brightness !== 1.0) {
      tempCtx.globalAlpha = brightness;
    }

    ctx.drawImage(tempCanvas, x, y, w, h);
  }

  /**
   * Save block
   */
  private saveBlock(): void {
    if (!this.currentBlock.name || !this.currentBlock.textures) {
      alert('Please fill in all required fields');
      return;
    }

    const block: BlockDefinition = {
      id: this.currentBlock.id || `custom_${Date.now()}`,
      name: this.currentBlock.name,
      category: this.currentBlock.category || 'basic',
      material: this.currentBlock.material || 'plastic',
      textures: this.currentBlock.textures,
      properties: this.currentBlock.properties || {
        solid: true,
        transparent: false,
        emissive: 0,
        roughness: 0.5,
        metallic: 0,
      },
    };

    // Save to localStorage
    this.saveToStorage(block);

    // Call callback
    if (this.onSaveCallback) {
      this.onSaveCallback(block);
    }

    this.hide();
  }

  /**
   * Save block to localStorage
   */
  private saveToStorage(block: BlockDefinition): void {
    const customBlocks = this.loadFromStorage();

    // Check if block already exists
    const existingIndex = customBlocks.findIndex((b) => b.definition.id === block.id);
    if (existingIndex >= 0) {
      customBlocks[existingIndex] = {
        id: block.id,
        definition: block,
        createdAt: customBlocks[existingIndex]!.createdAt,
      };
    } else {
      customBlocks.push({
        id: block.id,
        definition: block,
        createdAt: Date.now(),
      });
    }

    localStorage.setItem('customBlocks', JSON.stringify(customBlocks));
  }

  /**
   * Load custom blocks from localStorage
   */
  public loadFromStorage(): CustomBlockData[] {
    try {
      const data = localStorage.getItem('customBlocks');
      if (!data) return [];
      return JSON.parse(data) as CustomBlockData[];
    } catch {
      return [];
    }
  }

  /**
   * Delete a custom block from localStorage
   */
  public deleteFromStorage(blockId: string): boolean {
    try {
      const customBlocks = this.loadFromStorage();
      const updatedBlocks = customBlocks.filter((b) => b.definition.id !== blockId);

      if (updatedBlocks.length === customBlocks.length) {
        // Block not found
        return false;
      }

      localStorage.setItem('customBlocks', JSON.stringify(updatedBlocks));
      return true;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      // Replace with logger when available in this module's scope
      // Using dynamic import to avoid circular deps
      import('../../utils/logger').then(({ Logger }) => Logger.error('Failed to delete custom block:', error as unknown as Error)).catch(() => {});
      return false;
    }
  }

  // ===== Helper Methods =====

  private createSectionTitle(text: string): HTMLElement {
    const title = document.createElement('div');
    title.textContent = text;
    Object.assign(title.style, {
      fontSize: '1.05rem',
      fontWeight: '600',
      marginTop: '0.5rem',
      paddingBottom: '0.5rem',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    } as CSSStyleDeclaration);
    return title;
  }

  private createTextInput(
    label: string,
    value: string,
    onChange: (value: string) => void
  ): HTMLElement {
    return this.createLabeledInput(label, 'text', value, (e) =>
      onChange((e.target as HTMLInputElement).value)
    );
  }

  private createDropdown(
    label: string,
    options: string[],
    value: string,
    onChange: (value: string) => void
  ): HTMLElement {
    const container = document.createElement('div');

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    Object.assign(labelEl.style, {
      display: 'block',
      fontSize: '0.9rem',
      marginBottom: '0.4rem',
      color: 'rgba(255, 255, 255, 0.8)',
    } as CSSStyleDeclaration);

    const select = document.createElement('select');
    Object.assign(select.style, {
      width: '100%',
      padding: '0.6rem 0.8rem',
      background: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '8px',
      color: '#f5f5f5',
      cursor: 'pointer',
    } as CSSStyleDeclaration);

    for (const option of options) {
      const optionEl = document.createElement('option');
      optionEl.value = option;
      optionEl.textContent = option.charAt(0).toUpperCase() + option.slice(1);
      if (option === value) {
        optionEl.selected = true;
      }
      select.appendChild(optionEl);
    }

    select.addEventListener('change', () => onChange(select.value));

    container.appendChild(labelEl);
    container.appendChild(select);
    return container;
  }

  private createCheckbox(
    label: string,
    checked: boolean,
    onChange: (value: boolean) => void
  ): HTMLElement {
    const container = document.createElement('label');
    Object.assign(container.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '0.6rem',
      cursor: 'pointer',
      userSelect: 'none',
    } as CSSStyleDeclaration);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    Object.assign(checkbox.style, {
      width: '18px',
      height: '18px',
      cursor: 'pointer',
    } as CSSStyleDeclaration);
    checkbox.addEventListener('change', () => onChange(checkbox.checked));

    const labelText = document.createElement('span');
    labelText.textContent = label;
    Object.assign(labelText.style, {
      fontSize: '0.9rem',
    } as CSSStyleDeclaration);

    container.appendChild(checkbox);
    container.appendChild(labelText);
    return container;
  }

  private createSlider(
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onChange: (value: number) => void
  ): HTMLElement {
    const container = document.createElement('div');

    const labelRow = document.createElement('div');
    Object.assign(labelRow.style, {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '0.4rem',
    } as CSSStyleDeclaration);

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    Object.assign(labelEl.style, {
      fontSize: '0.9rem',
      color: 'rgba(255, 255, 255, 0.8)',
    } as CSSStyleDeclaration);

    const valueEl = document.createElement('span');
    valueEl.textContent = value.toFixed(2);
    Object.assign(valueEl.style, {
      fontSize: '0.85rem',
      color: 'rgba(255, 255, 255, 0.6)',
    } as CSSStyleDeclaration);

    labelRow.appendChild(labelEl);
    labelRow.appendChild(valueEl);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(value);
    Object.assign(slider.style, {
      width: '100%',
    } as CSSStyleDeclaration);

    slider.addEventListener('input', () => {
      const val = Number.parseFloat(slider.value);
      valueEl.textContent = val.toFixed(2);
      onChange(val);
    });

    container.appendChild(labelRow);
    container.appendChild(slider);
    return container;
  }

  private createLabeledInput(
    label: string,
    type: string,
    value: string,
    onChange: (e: Event) => void
  ): HTMLElement {
    const container = document.createElement('div');

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    Object.assign(labelEl.style, {
      display: 'block',
      fontSize: '0.9rem',
      marginBottom: '0.4rem',
      color: 'rgba(255, 255, 255, 0.8)',
    } as CSSStyleDeclaration);

    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    Object.assign(input.style, {
      width: '100%',
      padding: '0.6rem 0.8rem',
      background: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '8px',
      color: '#f5f5f5',
      fontSize: '0.95rem',
    } as CSSStyleDeclaration);

    input.addEventListener('input', onChange);

    container.appendChild(labelEl);
    container.appendChild(input);
    return container;
  }

  private createButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    Object.assign(button.style, {
      padding: '0.75rem 1.5rem',
      background: color,
      border: 'none',
      borderRadius: '10px',
      color: '#fff',
      fontSize: '1rem',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'transform 0.1s, opacity 0.2s',
    } as CSSStyleDeclaration);

    button.addEventListener('click', onClick);
    button.addEventListener('mouseenter', () => {
      button.style.opacity = '0.9';
      button.style.transform = 'translateY(-2px)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.opacity = '1';
      button.style.transform = 'translateY(0)';
    });

    return button;
  }

  // Color conversion helpers
  private rgbaToHex(rgba: RgbaColor): string {
    const r = Math.round(rgba[0] * 255)
      .toString(16)
      .padStart(2, '0');
    const g = Math.round(rgba[1] * 255)
      .toString(16)
      .padStart(2, '0');
    const b = Math.round(rgba[2] * 255)
      .toString(16)
      .padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  private hexToRgba(hex: string): RgbaColor {
    const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
    const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
    const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, 1];
  }
}
