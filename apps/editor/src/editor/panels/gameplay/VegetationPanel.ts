/**
 * VegetationPanel - Configuration panel for vegetation assets
 * 
 * Features:
 * - Configure vegetation type and parameters
 * - Set wind strength and frequency
 * - Configure harvest settings
 * - Preview vegetation configuration
 */

import type { AssetPreset } from '../../types/BlockAssetTypes';
import { createIcon } from '../../utils/icons';

export interface VegetationPanelConfig {
  /** Current vegetation asset preset (if any) */
  assetPreset: AssetPreset | null;
  /** Called when vegetation configuration changes */
  onConfigChanged: (config: AssetPreset['vegetationConfig']) => void;
  /** Called when new vegetation preset should be created */
  onCreatePreset?: (config: AssetPreset['vegetationConfig']) => void;
  /** Called to activate paint mode with given preset */
  onActivatePaint?: (preset: AssetPreset) => void;
  /** Called to update paint tool configuration */
  onUpdatePaintConfig?: (config: { brushRadius?: number; density?: number; minSpacing?: number }) => void;
  /** Optional undo registration callback */
  registerUndo?: (action: () => void) => void;
}

/**
 * VegetationPanel - UI panel for configuring vegetation parameters
 */
export class VegetationPanel {
  private readonly root: HTMLElement;
  private config: VegetationPanelConfig;
  private currentConfig: AssetPreset['vegetationConfig'] | null = null;

  constructor(config: VegetationPanelConfig) {
    this.config = config;
    this.currentConfig = config.assetPreset?.vegetationConfig ?? null;

    this.root = document.createElement('div');
    this.root.className = 'vegetation-panel';
    this.root.setAttribute('data-tab', 'Vegetation');

    this.render();
  }

  /**
   * Renders the vegetation panel UI
   */
  private render(): void {
    this.root.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'panel-header';
    
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'panel-header-icon';
    iconWrapper.appendChild(createIcon('circle', 20));
    
    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.textContent = 'Vegetation';

    header.appendChild(iconWrapper);
    header.appendChild(title);
    this.root.appendChild(header);

    const content = document.createElement('div');
    content.className = 'vegetation-panel-content custom-scrollbar';

    // Vegetation Type Selector
    const typeSection = this.createTypeSection();
    content.appendChild(typeSection);

    // Billboard Settings (for grass/flowers)
    if (this.currentConfig && (this.currentConfig.type === 'grass' || this.currentConfig.type === 'flower')) {
      const billboardSection = this.createBillboardSection();
      content.appendChild(billboardSection);
    }

    // 3D Model Settings (for trees/shrubs)
    if (this.currentConfig && (this.currentConfig.type === 'tree' || this.currentConfig.type === 'shrub')) {
      const modelSection = this.createModelSection();
      content.appendChild(modelSection);
    }

    // Wind Settings
    const windSection = this.createWindSection();
    content.appendChild(windSection);

    // Harvest Settings
    const harvestSection = this.createHarvestSection();
    content.appendChild(harvestSection);

    // Paint Tool Settings
    const paintSection = this.createPaintToolSection();
    content.appendChild(paintSection);

    // Action Buttons
    const actionsSection = this.createActionsSection();
    content.appendChild(actionsSection);

    this.root.appendChild(content);
  }

  /**
   * Creates vegetation type selector section
   */
  private createTypeSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const label = document.createElement('label');
    label.className = 'panel-label';
    label.textContent = 'Vegetation Type';
    section.appendChild(label);

    const select = document.createElement('select');
    select.className = 'panel-select';
    select.value = this.currentConfig?.type ?? 'grass';

    const types = [
      { value: 'grass', label: 'Grass' },
      { value: 'flower', label: 'Flower' },
      { value: 'shrub', label: 'Shrub' },
      { value: 'tree', label: 'Tree' },
      { value: 'custom', label: 'Custom' },
    ];

    for (const type of types) {
      const option = document.createElement('option');
      option.value = type.value;
      option.textContent = type.label;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      this.updateConfig({ type: select.value as any });
    });

    section.appendChild(select);
    return section;
  }

  /**
   * Creates billboard texture section
   */
  private createBillboardSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const label = document.createElement('label');
    label.className = 'panel-label';
    label.textContent = 'Billboard Texture';
    section.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'panel-input';
    input.placeholder = 'texture URL or path';
    input.value = this.currentConfig?.billboardTexture ?? '';

    input.addEventListener('input', () => {
      const trimmed = input.value.trim();
      // Basic URL validation (allow relative paths and URLs)
      const isValid = trimmed === '' || /^[a-zA-Z0-9._\/-]+$/.test(trimmed) || /^https?:\/\//.test(trimmed);
      if (!isValid && trimmed !== '') {
        console.warn('Invalid texture URL format');
        return;
      }
      const updates: Partial<AssetPreset['vegetationConfig']> = {};
      if (trimmed) {
        updates.billboardTexture = trimmed;
      }
      const prevValue = this.currentConfig?.billboardTexture ?? '';
      this.updateConfig(updates, prevValue !== trimmed ? () => {
        this.updateConfig({ billboardTexture: prevValue });
      } : undefined);
    });

    section.appendChild(input);
    return section;
  }

  /**
   * Creates 3D model section
   */
  private createModelSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const label = document.createElement('label');
    label.className = 'panel-label';
    label.textContent = '3D Model URL';
    section.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'panel-input';
    input.placeholder = 'model URL or path';
    input.value = this.currentConfig?.modelUrl ?? '';

    input.addEventListener('input', () => {
      const trimmed = input.value.trim();
      // Basic URL validation (allow relative paths and URLs)
      const isValid = trimmed === '' || /^[a-zA-Z0-9._\/-]+$/.test(trimmed) || /^https?:\/\//.test(trimmed);
      if (!isValid && trimmed !== '') {
        console.warn('Invalid model URL format');
        return;
      }
      const updates: Partial<AssetPreset['vegetationConfig']> = {};
      if (trimmed) {
        updates.modelUrl = trimmed;
      }
      const prevValue = this.currentConfig?.modelUrl ?? '';
      this.updateConfig(updates, prevValue !== trimmed ? () => {
        this.updateConfig({ modelUrl: prevValue });
      } : undefined);
    });

    section.appendChild(input);
    return section;
  }

  /**
   * Creates wind settings section
   */
  private createWindSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Wind Animation';
    section.appendChild(title);

    // Wind Strength
    const strengthWrapper = document.createElement('div');
    strengthWrapper.className = 'panel-input-group';

    const strengthLabel = document.createElement('label');
    strengthLabel.className = 'panel-label-small';
    strengthLabel.textContent = 'Strength (0-1)';
    strengthWrapper.appendChild(strengthLabel);

    const strengthInput = document.createElement('input');
    strengthInput.type = 'range';
    strengthInput.min = '0';
    strengthInput.max = '1';
    strengthInput.step = '0.01';
    strengthInput.value = String(this.currentConfig?.windStrength ?? 0.3);
    strengthInput.className = 'panel-slider';

    const strengthValue = document.createElement('span');
    strengthValue.className = 'panel-value';
    strengthValue.textContent = strengthInput.value;

    strengthInput.addEventListener('input', () => {
      strengthValue.textContent = strengthInput.value;
      const value = parseFloat(strengthInput.value);
      const clamped = Math.max(0, Math.min(1, isNaN(value) ? 0.3 : value));
      const prevValue = this.currentConfig?.windStrength ?? 0.3;
      this.updateConfig({ windStrength: clamped }, prevValue !== clamped ? () => {
        this.updateConfig({ windStrength: prevValue });
      } : undefined);
    });

    strengthWrapper.appendChild(strengthInput);
    strengthWrapper.appendChild(strengthValue);
    section.appendChild(strengthWrapper);

    // Wind Frequency
    const frequencyWrapper = document.createElement('div');
    frequencyWrapper.className = 'panel-input-group';

    const frequencyLabel = document.createElement('label');
    frequencyLabel.className = 'panel-label-small';
    frequencyLabel.textContent = 'Frequency';
    frequencyWrapper.appendChild(frequencyLabel);

    const frequencyInput = document.createElement('input');
    frequencyInput.type = 'range';
    frequencyInput.min = '0';
    frequencyInput.max = '5';
    frequencyInput.step = '0.1';
    frequencyInput.value = String(this.currentConfig?.windFrequency ?? 1.0);
    frequencyInput.className = 'panel-slider';

    const frequencyValue = document.createElement('span');
    frequencyValue.className = 'panel-value';
    frequencyValue.textContent = frequencyInput.value;

    frequencyInput.addEventListener('input', () => {
      frequencyValue.textContent = frequencyInput.value;
      const value = parseFloat(frequencyInput.value);
      const clamped = Math.max(0, Math.min(5, isNaN(value) ? 1.0 : value));
      const prevValue = this.currentConfig?.windFrequency ?? 1.0;
      this.updateConfig({ windFrequency: clamped }, prevValue !== clamped ? () => {
        this.updateConfig({ windFrequency: prevValue });
      } : undefined);
    });

    frequencyWrapper.appendChild(frequencyInput);
    frequencyWrapper.appendChild(frequencyValue);
    section.appendChild(frequencyWrapper);

    return section;
  }

  /**
   * Creates harvest settings section
   */
  private createHarvestSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Harvest Settings';
    section.appendChild(title);

    // Can Be Harvested
    const harvestWrapper = document.createElement('div');
    harvestWrapper.className = 'panel-checkbox-group';

    const harvestCheckbox = document.createElement('input');
    harvestCheckbox.type = 'checkbox';
    harvestCheckbox.id = 'can-be-harvested';
    harvestCheckbox.checked = this.currentConfig?.canBeHarvested ?? false;
    harvestCheckbox.className = 'panel-checkbox';

    const harvestLabel = document.createElement('label');
    harvestLabel.htmlFor = 'can-be-harvested';
    harvestLabel.className = 'panel-label-small';
    harvestLabel.textContent = 'Can Be Harvested';

    harvestCheckbox.addEventListener('change', () => {
      this.updateConfig({ canBeHarvested: harvestCheckbox.checked });
    });

    harvestWrapper.appendChild(harvestCheckbox);
    harvestWrapper.appendChild(harvestLabel);
    section.appendChild(harvestWrapper);

    // Harvest Time (only if canBeHarvested is true)
    if (this.currentConfig?.canBeHarvested) {
      const timeWrapper = document.createElement('div');
      timeWrapper.className = 'panel-input-group';

      const timeLabel = document.createElement('label');
      timeLabel.className = 'panel-label-small';
      timeLabel.textContent = 'Harvest Time (seconds, 0 = instant)';
      timeWrapper.appendChild(timeLabel);

      const timeInput = document.createElement('input');
      timeInput.type = 'number';
      timeInput.min = '0';
      timeInput.step = '0.1';
      timeInput.value = String(this.currentConfig?.harvestTime ?? 0);
      timeInput.className = 'panel-input';

      timeInput.addEventListener('input', () => {
        const value = parseFloat(timeInput.value);
        const clamped = Math.max(0, isNaN(value) ? 0 : value);
        const prevValue = this.currentConfig?.harvestTime ?? 0;
        this.updateConfig({ harvestTime: clamped }, prevValue !== clamped ? () => {
          this.updateConfig({ harvestTime: prevValue });
        } : undefined);
      });

      timeWrapper.appendChild(timeInput);
      section.appendChild(timeWrapper);
    }

    return section;
  }

  /**
   * Creates paint tool settings section
   */
  private createPaintToolSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Paint Tool';
    section.appendChild(title);

    // Brush Radius
    const radiusWrapper = document.createElement('div');
    radiusWrapper.className = 'panel-input-group';

    const radiusLabel = document.createElement('label');
    radiusLabel.className = 'panel-label-small';
    radiusLabel.textContent = 'Brush Radius';
    radiusWrapper.appendChild(radiusLabel);

    const radiusInput = document.createElement('input');
    radiusInput.type = 'number';
    radiusInput.min = '0.5';
    radiusInput.max = '20';
    radiusInput.step = '0.5';
    radiusInput.value = '3.0';
    radiusInput.className = 'panel-input';

    radiusInput.addEventListener('input', () => {
      const value = parseFloat(radiusInput.value);
      const clamped = Math.max(0.5, Math.min(20, isNaN(value) ? 3.0 : value));
      if (!isNaN(value) && this.config.onUpdatePaintConfig) {
        this.config.onUpdatePaintConfig({ brushRadius: clamped });
      }
      // Update input value if clamped
      if (clamped !== value) {
        radiusInput.value = String(clamped);
      }
    });

    radiusWrapper.appendChild(radiusInput);
    section.appendChild(radiusWrapper);

    // Density
    const densityWrapper = document.createElement('div');
    densityWrapper.className = 'panel-input-group';

    const densityLabel = document.createElement('label');
    densityLabel.className = 'panel-label-small';
    densityLabel.textContent = 'Density (0-1)';
    densityWrapper.appendChild(densityLabel);

    const densityInput = document.createElement('input');
    densityInput.type = 'range';
    densityInput.min = '0';
    densityInput.max = '1';
    densityInput.step = '0.01';
    densityInput.value = '0.3';
    densityInput.className = 'panel-slider';

    const densityValue = document.createElement('span');
    densityValue.className = 'panel-value';
    densityValue.textContent = densityInput.value;

    densityInput.addEventListener('input', () => {
      densityValue.textContent = densityInput.value;
      const value = parseFloat(densityInput.value);
      const clamped = Math.max(0, Math.min(1, isNaN(value) ? 0.3 : value));
      if (!isNaN(value) && this.config.onUpdatePaintConfig) {
        this.config.onUpdatePaintConfig({ density: clamped });
      }
      // Update display if clamped
      if (clamped !== value) {
        densityValue.textContent = String(clamped);
      }
    });

    densityWrapper.appendChild(densityInput);
    densityWrapper.appendChild(densityValue);
    section.appendChild(densityWrapper);

    // Paint Button
    const paintButton = document.createElement('button');
    paintButton.className = 'panel-button panel-button-secondary';
    paintButton.textContent = 'Activate Paint Mode';
    paintButton.addEventListener('click', () => {
      if (this.currentConfig && this.config.onActivatePaint && this.config.assetPreset) {
        const preset: AssetPreset = {
          ...this.config.assetPreset,
          vegetationConfig: this.currentConfig,
        };
        this.config.onActivatePaint(preset);
      }
    });

    section.appendChild(paintButton);
    return section;
  }

  /**
   * Creates action buttons section
   */
  private createActionsSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section panel-actions';

    const createButton = document.createElement('button');
    createButton.className = 'panel-button panel-button-primary';
    createButton.textContent = 'Create Vegetation Preset';
    createButton.addEventListener('click', () => {
      if (this.currentConfig && this.config.onCreatePreset) {
        this.config.onCreatePreset(this.currentConfig);
      }
    });

    section.appendChild(createButton);
    return section;
  }

  /**
   * Updates current configuration
   */
  private updateConfig(updates: Partial<AssetPreset['vegetationConfig']>, undoAction?: () => void): void {
    const prevConfig = this.currentConfig ? { ...this.currentConfig } : null;
    
    this.currentConfig = {
      ...(this.currentConfig ?? {
        type: 'grass',
        windStrength: 0.3,
        windFrequency: 1.0,
        canBeHarvested: false,
      }),
      ...updates,
    };

    // Register undo action if provided
    if (undoAction && this.config.registerUndo && prevConfig) {
      this.config.registerUndo(() => {
        this.currentConfig = prevConfig;
        this.config.onConfigChanged(this.currentConfig);
        if (updates?.type !== undefined) {
          this.render();
        }
      });
    }

    this.config.onConfigChanged(this.currentConfig);
    
    // Re-render if type changed (sections might change)
    if (updates?.type !== undefined) {
      this.render();
    }
  }

  /**
   * Updates the panel with a new asset preset
   */
  public updateAssetPreset(preset: AssetPreset | null): void {
    this.config.assetPreset = preset;
    this.currentConfig = preset?.vegetationConfig ?? null;
    this.render();
  }

  /**
   * Gets the panel root element
   */
  public get element(): HTMLElement {
    return this.root;
  }

  /**
   * Disposes the panel
   */
  public dispose(): void {
    this.root.remove();
  }
}

