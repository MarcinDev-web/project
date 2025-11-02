/**
 * TerrainPanel - Configuration panel for terrain editing
 *
 * UI panel for terrain creation, editing, and configuration.
 */

import type { TerrainBuilderStudio } from '../TerrainBuilderStudio';
import type { Entity } from '@engine/world';
import { createIcon } from '../../utils/icons';

export interface TerrainPanelConfig {
  terrainStudio: TerrainBuilderStudio;
  onTerrainCreated?: (entity: Entity) => void;
  onTerrainSelected?: (entity: Entity | null) => void;
}

/**
 * TerrainPanel - UI panel for terrain configuration
 */
export class TerrainPanel {
  private readonly root: HTMLElement;
  private config: TerrainPanelConfig;
  private currentEntity: Entity | null = null;

  constructor(config: TerrainPanelConfig) {
    this.config = config;

    this.root = document.createElement('div');
    this.root.className = 'terrain-panel';
    this.root.setAttribute('data-tab', 'Terrain');

    this.render();
  }

  /**
   * Renders the terrain panel UI
   */
  private render(): void {
    this.root.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'panel-header';

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'panel-header-icon';
    // Using 'grid' icon as placeholder (can add terrain icon later)
    iconWrapper.appendChild(createIcon('grid', 20));

    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.textContent = 'Terrain Builder';

    header.appendChild(iconWrapper);
    header.appendChild(title);
    this.root.appendChild(header);

    const content = document.createElement('div');
    content.className = 'terrain-panel-content custom-scrollbar';

    // Terrain Creation Section
    const creationSection = this.createCreationSection();
    content.appendChild(creationSection);

    // Terrain Properties Section
    const propertiesSection = this.createPropertiesSection();
    content.appendChild(propertiesSection);

    // Brush Settings Section
    const brushSection = this.createBrushSection();
    content.appendChild(brushSection);

    // Sculpting Controls Section
    const sculptSection = this.createSculptSection();
    content.appendChild(sculptSection);

    // Import/Export Section
    const importExportSection = this.createImportExportSection();
    content.appendChild(importExportSection);

    this.root.appendChild(content);
  }

  /**
   * Creates terrain creation section
   */
  private createCreationSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Create Terrain';
    section.appendChild(title);

    // Resolution selector
    const resolutionGroup = document.createElement('div');
    resolutionGroup.className = 'panel-input-group';

    const resolutionLabel = document.createElement('label');
    resolutionLabel.className = 'panel-label-small';
    resolutionLabel.textContent = 'Resolution';
    resolutionGroup.appendChild(resolutionLabel);

    const resolutionSelect = document.createElement('select');
    resolutionSelect.className = 'panel-select';
    const resolutions = [65, 129, 257, 513];
    for (const res of resolutions) {
      const option = document.createElement('option');
      option.value = String(res);
      option.textContent = `${res}x${res}`;
      resolutionSelect.appendChild(option);
    }
    resolutionSelect.value = '129';
    resolutionGroup.appendChild(resolutionSelect);

    section.appendChild(resolutionGroup);

    // Size input
    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'panel-input-group';

    const sizeLabel = document.createElement('label');
    sizeLabel.className = 'panel-label-small';
    sizeLabel.textContent = 'Size (world units)';
    sizeGroup.appendChild(sizeLabel);

    const sizeInput = document.createElement('input');
    sizeInput.type = 'number';
    sizeInput.min = '10';
    sizeInput.max = '1000';
    sizeInput.step = '10';
    sizeInput.value = '100';
    sizeInput.className = 'panel-input';
    sizeGroup.appendChild(sizeInput);

    section.appendChild(sizeGroup);

    // Create button
    const createButton = document.createElement('button');
    createButton.className = 'panel-button panel-button-primary';
    createButton.textContent = 'Create Heightmap Terrain';
    createButton.addEventListener('click', () => {
      const resolution = parseInt(resolutionSelect.value, 10);
      const size = parseFloat(sizeInput.value);

      const entity = this.config.terrainStudio.createHeightmapTerrain({
        resolution,
        size,
        minHeight: 0,
        maxHeight: 100,
      });

      this.setCurrentTerrain(entity);
      this.config.onTerrainCreated?.(entity);
    });

    section.appendChild(createButton);

    return section;
  }

  /**
   * Creates terrain properties section
   */
  private createPropertiesSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Terrain Properties';
    section.appendChild(title);

    // Height range
    const heightRangeGroup = document.createElement('div');
    heightRangeGroup.className = 'panel-input-group';

    const heightMinLabel = document.createElement('label');
    heightMinLabel.className = 'panel-label-small';
    heightMinLabel.textContent = 'Min Height';
    heightRangeGroup.appendChild(heightMinLabel);

    const heightMinInput = document.createElement('input');
    heightMinInput.type = 'number';
    heightMinInput.value = '0';
    heightMinInput.className = 'panel-input';
    heightRangeGroup.appendChild(heightMinInput);

    section.appendChild(heightRangeGroup);

    const heightMaxGroup = document.createElement('div');
    heightMaxGroup.className = 'panel-input-group';

    const heightMaxLabel = document.createElement('label');
    heightMaxLabel.className = 'panel-label-small';
    heightMaxLabel.textContent = 'Max Height';
    heightMaxGroup.appendChild(heightMaxLabel);

    const heightMaxInput = document.createElement('input');
    heightMaxInput.type = 'number';
    heightMaxInput.value = '100';
    heightMaxInput.className = 'panel-input';
    heightMaxGroup.appendChild(heightMaxInput);

    section.appendChild(heightMaxGroup);

    // Noise generation
    const noiseGroup = document.createElement('div');
    noiseGroup.className = 'panel-input-group';

    const noiseButton = document.createElement('button');
    noiseButton.className = 'panel-button panel-button-secondary';
    noiseButton.textContent = 'Apply Noise';
    noiseButton.addEventListener('click', () => {
      if (!this.currentEntity) return;

      const scale = 5;
      const amplitude = 10;
      this.config.terrainStudio.applyNoise(this.currentEntity, scale, amplitude);
    });

    noiseGroup.appendChild(noiseButton);

    // Smooth button
    const smoothButton = document.createElement('button');
    smoothButton.className = 'panel-button panel-button-secondary';
    smoothButton.textContent = 'Smooth';
    smoothButton.addEventListener('click', () => {
      if (!this.currentEntity) return;
      this.config.terrainStudio.applySmooth(this.currentEntity, 1);
    });

    noiseGroup.appendChild(smoothButton);

    section.appendChild(noiseGroup);

    return section;
  }

  /**
   * Creates brush settings section
   */
  private createBrushSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Brush Settings';
    section.appendChild(title);

    // Brush size
    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'panel-input-group';

    const sizeLabel = document.createElement('label');
    sizeLabel.className = 'panel-label-small';
    sizeLabel.textContent = 'Brush Size';
    sizeGroup.appendChild(sizeLabel);

    const sizeInput = document.createElement('input');
    sizeInput.type = 'range';
    sizeInput.min = '0.5';
    sizeInput.max = '20';
    sizeInput.step = '0.5';
    sizeInput.value = '5';
    sizeInput.className = 'panel-slider';

    const sizeValue = document.createElement('span');
    sizeValue.className = 'panel-value';
    sizeValue.textContent = sizeInput.value;

    sizeInput.addEventListener('input', () => {
      sizeValue.textContent = sizeInput.value;
      this.config.terrainStudio.updateBrushConfig({
        size: parseFloat(sizeInput.value),
      });
    });

    sizeGroup.appendChild(sizeInput);
    sizeGroup.appendChild(sizeValue);
    section.appendChild(sizeGroup);

    // Brush intensity
    const intensityGroup = document.createElement('div');
    intensityGroup.className = 'panel-input-group';

    const intensityLabel = document.createElement('label');
    intensityLabel.className = 'panel-label-small';
    intensityLabel.textContent = 'Intensity';
    intensityGroup.appendChild(intensityLabel);

    const intensityInput = document.createElement('input');
    intensityInput.type = 'range';
    intensityInput.min = '0';
    intensityInput.max = '1';
    intensityInput.step = '0.01';
    intensityInput.value = '1';
    intensityInput.className = 'panel-slider';

    const intensityValue = document.createElement('span');
    intensityValue.className = 'panel-value';
    intensityValue.textContent = intensityInput.value;

    intensityInput.addEventListener('input', () => {
      intensityValue.textContent = intensityInput.value;
      this.config.terrainStudio.updateBrushConfig({
        intensity: parseFloat(intensityInput.value),
      });
    });

    intensityGroup.appendChild(intensityInput);
    intensityGroup.appendChild(intensityValue);
    section.appendChild(intensityGroup);

    // Falloff type
    const falloffGroup = document.createElement('div');
    falloffGroup.className = 'panel-input-group';

    const falloffLabel = document.createElement('label');
    falloffLabel.className = 'panel-label-small';
    falloffLabel.textContent = 'Falloff';
    falloffGroup.appendChild(falloffLabel);

    const falloffSelect = document.createElement('select');
    falloffSelect.className = 'panel-select';
    const falloffs = ['linear', 'smooth', 'spherical'];
    for (const falloff of falloffs) {
      const option = document.createElement('option');
      option.value = falloff;
      option.textContent = falloff.charAt(0).toUpperCase() + falloff.slice(1);
      falloffSelect.appendChild(option);
    }
    falloffSelect.value = 'smooth';

    falloffSelect.addEventListener('change', () => {
      this.config.terrainStudio.updateBrushConfig({
        falloff: falloffSelect.value as 'linear' | 'smooth' | 'spherical',
      });
    });

    falloffGroup.appendChild(falloffSelect);
    section.appendChild(falloffGroup);

    return section;
  }

  /**
   * Creates sculpting controls section
   */
  private createSculptSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Sculpting Tools';
    section.appendChild(title);

    // Operation buttons
    const operations = [
      { key: 'raise', label: 'Raise (R)' },
      { key: 'lower', label: 'Lower (L)' },
      { key: 'smooth', label: 'Smooth (S)' },
      { key: 'flatten', label: 'Flatten (F)' },
      { key: 'pinch', label: 'Pinch (P)' },
    ];

    for (const op of operations) {
      const button = document.createElement('button');
      button.className = 'panel-button panel-button-secondary';
      button.textContent = op.label;
      button.addEventListener('click', () => {
        this.config.terrainStudio.setBrushOperation(op.key as any);
      });
      section.appendChild(button);
    }

    // Activate sculpt mode button
    const activateButton = document.createElement('button');
    activateButton.className = 'panel-button panel-button-primary';
    activateButton.textContent = 'Activate Sculpt Mode';
    activateButton.addEventListener('click', () => {
      if (this.currentEntity) {
        this.config.terrainStudio.activateSculptMode(this.currentEntity);
      } else {
        this.config.terrainStudio.activateSculptMode();
      }
    });

    section.appendChild(activateButton);

    // Deactivate button
    const deactivateButton = document.createElement('button');
    deactivateButton.className = 'panel-button panel-button-secondary';
    deactivateButton.textContent = 'Deactivate Sculpt Mode';
    deactivateButton.addEventListener('click', () => {
      this.config.terrainStudio.deactivateSculptMode();
    });

    section.appendChild(deactivateButton);

    return section;
  }

  /**
   * Creates import/export section
   */
  private createImportExportSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Import / Export';
    section.appendChild(title);

    // Import from image
    const importGroup = document.createElement('div');
    importGroup.className = 'panel-input-group';

    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'image/*';
    importInput.className = 'panel-input';
    importInput.addEventListener('change', async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const url = URL.createObjectURL(file);
      try {
        const entity = await this.config.terrainStudio.generateFromImage(url, {
          size: 100,
          minHeight: 0,
          maxHeight: 100,
        });
        this.setCurrentTerrain(entity);
        this.config.onTerrainCreated?.(entity);
      } catch (error) {
        console.error('Failed to import terrain from image:', error);
      } finally {
        URL.revokeObjectURL(url);
      }
    });

    importGroup.appendChild(importInput);

    const importButton = document.createElement('button');
    importButton.className = 'panel-button panel-button-secondary';
    importButton.textContent = 'Import from Image';
    importButton.addEventListener('click', () => {
      importInput.click();
    });

    importGroup.appendChild(importButton);
    section.appendChild(importGroup);

    // Export to image
    const exportButton = document.createElement('button');
    exportButton.className = 'panel-button panel-button-secondary';
    exportButton.textContent = 'Export to Image';
    exportButton.addEventListener('click', async () => {
      if (!this.currentEntity) return;

      try {
        const dataUrl = await this.config.terrainStudio.exportToImage(this.currentEntity);
        // Create download link
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'terrain-heightmap.png';
        link.click();
      } catch (error) {
        console.error('Failed to export terrain:', error);
      }
    });

    section.appendChild(exportButton);

    return section;
  }

  /**
   * Sets the current terrain entity
   */
  setCurrentTerrain(entity: Entity | null): void {
    this.currentEntity = entity;
    this.config.onTerrainSelected?.(entity);
  }

  /**
   * Gets the panel root element
   */
  get element(): HTMLElement {
    return this.root;
  }

  /**
   * Disposes the panel
   */
  dispose(): void {
    this.root.remove();
  }
}

