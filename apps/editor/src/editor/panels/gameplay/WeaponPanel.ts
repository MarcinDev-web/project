/**
 * WeaponPanel - Configuration panel for weapon entities
 * 
 * Features:
 * - Configure weapon preset and base stats
 * - Add/remove attachments
 * - Configure ammo type and count
 * - Setup weapon inventory
 * - View effective stats with modifiers
 */

import type { Entity } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import { WeaponComponent } from '@engine/world/components/WeaponComponent';
import { InventoryComponent } from '@engine/world/components/InventoryComponent';
import { AttachmentComponent } from '@engine/world/components/AttachmentComponent';
import {
  setupWeaponEntity,
  addAttachment,
  removeAttachment,
  changeAmmoType,
  getEffectiveWeaponStats,
  getAllAttachmentIds,
  getAllAmmoTypeNames,
  WeaponLoadouts,
  setupPvPLoadout,
} from '@engine/world';
import type { WeaponPresetType, AmmoType } from '@engine/world/types/weapon';
import { getAttachment } from '@engine/world/data/attachments';
import { getAmmoType } from '@engine/world/data/ammo';
import { createIcon } from '../../utils/icons';

export interface WeaponPanelConfig {
  /** Selection manager */
  selection: SelectionManager;
  /** Scene for creating entities */
  scene: any;
  /** Called when weapon configuration changes */
  onConfigChanged?: () => void;
  /** Called to update scene buffers */
  updateSceneBuffers?: () => void;
  /** Optional undo registration callback */
  registerUndo?: (action: () => void) => void;
}

/**
 * WeaponPanel - UI panel for configuring weapon parameters
 */
export class WeaponPanel {
  private readonly root: HTMLElement;
  private config: WeaponPanelConfig;
  private selectedEntity: Entity | null = null;
  private weaponComponent: WeaponComponent | null = null;
  private inventoryComponent: InventoryComponent | null = null;
  private selectionUpdateInterval: number | null = null;
  private selectionChangeHandler: (() => void) | null = null;

  constructor(config: WeaponPanelConfig) {
    this.config = config;
    this.root = document.createElement('div');
    this.root.className = 'weapon-panel';
    this.root.setAttribute('data-tab', 'Weapons');

    // Listen to selection changes
    if (config.selection) {
      const updateSelection = () => {
        const selected = config.selection.primarySelection;
        this.selectedEntity = selected;
        this.weaponComponent = selected?.getComponent(WeaponComponent) ?? null;
        this.inventoryComponent = selected?.getComponent(InventoryComponent) ?? null;
        this.render();
      };
      
      this.selectionChangeHandler = updateSelection;
      
      // Initial update
      updateSelection();
      
      // Subscribe to selection changes (if available)
      if (typeof (config.selection as any).onSelectionChanged === 'function') {
        (config.selection as any).onSelectionChanged(updateSelection);
      } else {
        // Fallback: poll or use event system
        this.selectionUpdateInterval = window.setInterval(() => {
          const current = config.selection.primarySelection;
          if (current !== this.selectedEntity) {
            updateSelection();
          }
        }, 100);
      }
    } else {
      this.render();
    }
  }

  /**
   * Gets the root element
   */
  get element(): HTMLElement {
    return this.root;
  }

  /**
   * Updates the panel based on current selection
   */
  refresh(): void {
    if (this.config.selection) {
      const selected = this.config.selection.primarySelection;
      this.selectedEntity = selected;
      this.weaponComponent = selected?.getComponent(WeaponComponent) ?? null;
      this.inventoryComponent = selected?.getComponent(InventoryComponent) ?? null;
      this.render();
    }
  }

  /**
   * Creates a generic panel section with title
   */
  private createSection(title: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const titleEl = document.createElement('h3');
    titleEl.className = 'panel-section-title';
    titleEl.textContent = title;
    section.appendChild(titleEl);

    return section;
  }

  /**
   * Creates a labeled number input
   */
  private createNumberInput(
    label: string,
    value: number,
    config: {
      min?: number;
      max?: number;
      step?: number;
      onChange: (newValue: number) => void;
    }
  ): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'panel-input-group';

    const labelEl = document.createElement('label');
    labelEl.className = 'panel-label-small';
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'panel-input';
    if (config.min !== undefined) input.min = String(config.min);
    if (config.max !== undefined) input.max = String(config.max);
    if (config.step !== undefined) input.step = String(config.step);
    input.value = String(value);

    input.addEventListener('change', () => {
      let newValue = parseFloat(input.value);
      if (isNaN(newValue)) {
        input.value = String(value);
        return;
      }
      if (config.min !== undefined) newValue = Math.max(config.min, newValue);
      if (config.max !== undefined) newValue = Math.min(config.max, newValue);
      
      // Update UI if clamped
      if (newValue !== parseFloat(input.value)) {
        input.value = String(newValue);
      }
      
      config.onChange(newValue);
    });

    wrapper.appendChild(input);
    return wrapper;
  }

  /**
   * Creates a slider with number input
   */
  private createSlider(
    label: string,
    value: number,
    config: {
      min: number;
      max: number;
      step: number;
      onChange: (newValue: number) => void;
    }
  ): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'panel-input-group';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '4px';

    const labelEl = document.createElement('label');
    labelEl.className = 'panel-label-small';
    labelEl.textContent = label;
    header.appendChild(labelEl);

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'panel-value-display';
    valueDisplay.textContent = String(value);
    header.appendChild(valueDisplay);

    wrapper.appendChild(header);

    const sliderContainer = document.createElement('div');
    sliderContainer.style.display = 'flex';
    sliderContainer.style.alignItems = 'center';
    sliderContainer.style.gap = '8px';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'panel-slider';
    slider.style.flex = '1';
    slider.min = String(config.min);
    slider.max = String(config.max);
    slider.step = String(config.step);
    slider.value = String(value);

    slider.addEventListener('input', () => {
      const newValue = parseFloat(slider.value);
      valueDisplay.textContent = String(newValue);
    });

    slider.addEventListener('change', () => {
      const newValue = parseFloat(slider.value);
      config.onChange(newValue);
    });

    sliderContainer.appendChild(slider);
    wrapper.appendChild(sliderContainer);

    return wrapper;
  }

  /**
   * Renders the weapon panel UI
   */
  private render(): void {
    this.root.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'panel-header';
    
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'panel-header-icon';
    iconWrapper.appendChild(createIcon('target', 20));
    
    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.textContent = 'Weapons';

    header.appendChild(iconWrapper);
    header.appendChild(title);
    this.root.appendChild(header);

    const content = document.createElement('div');
    content.className = 'weapon-panel-content custom-scrollbar';

    if (!this.selectedEntity) {
      const empty = document.createElement('div');
      empty.className = 'panel-empty';
      empty.textContent = 'Select an entity to configure weapons';
      content.appendChild(empty);
      this.root.appendChild(content);
      return;
    }

    // Check if entity has weapon or inventory
    if (this.inventoryComponent) {
      // Show inventory configuration
      const inventorySection = this.createInventorySection();
      content.appendChild(inventorySection);
    } else if (this.weaponComponent) {
      // Show single weapon configuration
      const weaponSection = this.createWeaponSection();
      content.appendChild(weaponSection);
    } else {
      // Show setup options
      const setupSection = this.createSetupSection();
      content.appendChild(setupSection);
    }

    this.root.appendChild(content);
  }

  /**
   * Creates setup section for entities without weapons
   */
  private createSetupSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Setup Weapon';
    section.appendChild(title);

    const info = document.createElement('div');
    info.className = 'panel-info';
    info.textContent = 'This entity has no weapon. Choose a setup option:';
    section.appendChild(info);

    // Quick setup buttons
    const quickSetup = document.createElement('div');
    quickSetup.className = 'panel-button-group';

    const rifleBtn = document.createElement('button');
    rifleBtn.className = 'panel-button';
    rifleBtn.textContent = 'Assault Rifle';
    rifleBtn.addEventListener('click', () => {
      if (this.selectedEntity) {
        WeaponLoadouts.assaultRifle(this.selectedEntity);
        this.refresh();
        this.config.onConfigChanged?.();
        this.config.updateSceneBuffers?.();
      }
    });
    quickSetup.appendChild(rifleBtn);

    const sniperBtn = document.createElement('button');
    sniperBtn.className = 'panel-button';
    sniperBtn.textContent = 'Sniper';
    sniperBtn.addEventListener('click', () => {
      if (this.selectedEntity) {
        WeaponLoadouts.sniper(this.selectedEntity);
        this.refresh();
        this.config.onConfigChanged?.();
        this.config.updateSceneBuffers?.();
      }
    });
    quickSetup.appendChild(sniperBtn);

    const pistolBtn = document.createElement('button');
    pistolBtn.className = 'panel-button';
    pistolBtn.textContent = 'Pistol';
    pistolBtn.addEventListener('click', () => {
      if (this.selectedEntity) {
        WeaponLoadouts.pistol(this.selectedEntity);
        this.refresh();
        this.config.onConfigChanged?.();
        this.config.updateSceneBuffers?.();
      }
    });
    quickSetup.appendChild(pistolBtn);

    const inventoryBtn = document.createElement('button');
    inventoryBtn.className = 'panel-button panel-button-primary';
    inventoryBtn.textContent = 'PvP Loadout (3 Weapons)';
    inventoryBtn.addEventListener('click', () => {
      if (this.selectedEntity) {
        setupPvPLoadout(this.selectedEntity);
        this.refresh();
        this.config.onConfigChanged?.();
        this.config.updateSceneBuffers?.();
      }
    });
    quickSetup.appendChild(inventoryBtn);

    section.appendChild(quickSetup);

    // Custom preset selector
    const presetSection = this.createPresetSelector(null);
    section.appendChild(presetSection);

    return section;
  }

  /**
   * Creates weapon configuration section
   */
  private createWeaponSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    if (!this.weaponComponent || !this.selectedEntity) {
      return section;
    }

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Weapon Configuration';
    section.appendChild(title);

    // Preset selector
    const presetSection = this.createPresetSelector(this.weaponComponent.weaponPreset ?? 'custom');
    section.appendChild(presetSection);

    // Base stats editor
    const baseStatsSection = this.createBaseStatsSection();
    section.appendChild(baseStatsSection);

    // Attachments
    const attachmentsSection = this.createAttachmentsSection();
    section.appendChild(attachmentsSection);

    // Ammo configuration
    const ammoSection = this.createAmmoSection();
    section.appendChild(ammoSection);

    // Effective stats (read-only display)
    const statsSection = this.createStatsSection();
    section.appendChild(statsSection);

    return section;
  }

  /**
   * Creates base stats editor section
   */
  private createBaseStatsSection(): HTMLElement {
    const section = this.createSection('Base Stats');

    if (!this.weaponComponent || !this.selectedEntity) {
      return section;
    }

    // Helper to update stat and handle undo/preset switch
    const updateStat = (key: keyof WeaponComponent, value: number) => {
      if (!this.weaponComponent || !this.selectedEntity) return;

      const oldValue = this.weaponComponent[key] as number;
      if (oldValue === value) return;

      // Switch to custom preset if not already
      const oldPreset = this.weaponComponent.weaponPreset;
      if (oldPreset !== 'custom') {
        this.weaponComponent.weaponPreset = 'custom';
      }

      (this.weaponComponent as any)[key] = value;
      
      // Force update of effective stats
      this.weaponComponent.invalidateEffectiveStats();

      // Register undo
      if (this.config.registerUndo) {
        const entity = this.selectedEntity;
        const component = this.weaponComponent;
        const prevPreset = oldPreset;
        
        this.config.registerUndo(() => {
          if (component && entity) {
            (component as any)[key] = oldValue;
            if (prevPreset !== 'custom') {
              component.weaponPreset = prevPreset;
            }
            component.invalidateEffectiveStats();
            this.refresh();
            this.config.onConfigChanged?.();
            this.config.updateSceneBuffers?.();
          }
        });
      }

      this.refresh();
      this.config.onConfigChanged?.();
      this.config.updateSceneBuffers?.();
    };

    // Damage
    section.appendChild(this.createSlider('Damage', this.weaponComponent.damage, {
      min: 0, max: 200, step: 1,
      onChange: (v) => updateStat('damage', v)
    }));

    // Fire Rate
    section.appendChild(this.createSlider('Fire Rate', this.weaponComponent.fireRate, {
      min: 0.1, max: 20, step: 0.1,
      onChange: (v) => updateStat('fireRate', v)
    }));

    // Range
    section.appendChild(this.createSlider('Range', this.weaponComponent.range, {
      min: 1, max: 500, step: 1,
      onChange: (v) => updateStat('range', v)
    }));

    // Spread
    section.appendChild(this.createSlider('Spread', this.weaponComponent.spread, {
      min: 0, max: 0.5, step: 0.001,
      onChange: (v) => updateStat('spread', v)
    }));

    // Max Ammo
    section.appendChild(this.createNumberInput('Max Ammo', this.weaponComponent.maxAmmo, {
      min: 1, max: 1000, step: 1,
      onChange: (v) => updateStat('maxAmmo', v)
    }));

    // Reload Duration
    section.appendChild(this.createSlider('Reload Duration', this.weaponComponent.reloadDuration, {
      min: 0.1, max: 10, step: 0.1,
      onChange: (v) => updateStat('reloadDuration', v)
    }));

    // Projectile Speed
    section.appendChild(this.createSlider('Projectile Speed', this.weaponComponent.projectileSpeed, {
      min: 1, max: 200, step: 1,
      onChange: (v) => updateStat('projectileSpeed', v)
    }));

    return section;
  }

  /**
   * Creates inventory configuration section
   */
  private createInventorySection(): HTMLElement {
    const section = this.createSection('Weapon Inventory');

    if (!this.inventoryComponent || !this.selectedEntity) {
      return section;
    }

    // Helper to update inventory stats
    const updateInventory = (key: keyof InventoryComponent, value: number) => {
      if (!this.inventoryComponent) return;
      
      const oldValue = this.inventoryComponent[key] as number;
      if (oldValue === value) return;

      (this.inventoryComponent as any)[key] = value;

      // Register undo
      if (this.config.registerUndo) {
        const component = this.inventoryComponent;
        this.config.registerUndo(() => {
          (component as any)[key] = oldValue;
          this.refresh();
          this.config.onConfigChanged?.();
        });
      }

      this.refresh();
      this.config.onConfigChanged?.();
    };

    // Inventory settings
    const settingsGroup = document.createElement('div');
    settingsGroup.style.marginBottom = '16px';
    
    settingsGroup.appendChild(this.createNumberInput('Max Capacity', this.inventoryComponent.maxWeapons, {
      min: 1, max: 10, step: 1,
      onChange: (v) => updateInventory('maxWeapons', v)
    }));

    settingsGroup.appendChild(this.createSlider('Switch Time (s)', this.inventoryComponent.switchDuration, {
      min: 0.1, max: 5.0, step: 0.1,
      onChange: (v) => updateInventory('switchDuration', v)
    }));
    
    section.appendChild(settingsGroup);

    const info = document.createElement('div');
    info.className = 'panel-info';
    info.textContent = `Active weapon: ${this.inventoryComponent.getActiveWeaponIndex() + 1} / ${this.inventoryComponent.getWeaponCount()}`;
    section.appendChild(info);

    // List weapons
    const weaponsList = document.createElement('div');
    weaponsList.className = 'weapon-list';

    for (let i = 0; i < this.inventoryComponent.getWeaponCount(); i++) {
      const weapon = this.inventoryComponent.getWeapon(i);
      if (!weapon) continue;

      const weaponItem = document.createElement('div');
      weaponItem.className = `weapon-item ${i === this.inventoryComponent.getActiveWeaponIndex() ? 'active' : ''}`;

      const weaponLabel = document.createElement('div');
      weaponLabel.className = 'weapon-label';
      weaponLabel.textContent = `${i + 1}. ${weapon.weaponPreset ?? 'Custom'} (${weapon.ammo}/${weapon.getEffectiveMaxAmmo()})`;
      weaponItem.appendChild(weaponLabel);

      const weaponActions = document.createElement('div');
      weaponActions.className = 'weapon-actions';

      if (i !== this.inventoryComponent.getActiveWeaponIndex()) {
        const switchBtn = document.createElement('button');
        switchBtn.className = 'panel-button-small';
        switchBtn.textContent = 'Switch';
        switchBtn.addEventListener('click', () => {
          if (this.inventoryComponent?.switchWeapon(i, performance.now() / 1000)) {
             this.refresh();
             this.config.onConfigChanged?.();
          }
        });
        weaponActions.appendChild(switchBtn);
      }

      const removeBtn = document.createElement('button');
      removeBtn.className = 'panel-button-small panel-button-danger';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        this.inventoryComponent?.removeWeapon(i);
        this.refresh();
        this.config.onConfigChanged?.();
        this.config.updateSceneBuffers?.();
      });
      weaponActions.appendChild(removeBtn);

      weaponItem.appendChild(weaponActions);
      weaponsList.appendChild(weaponItem);
    }

    section.appendChild(weaponsList);

    // Add weapon button
    const addWeaponBtn = document.createElement('button');
    addWeaponBtn.className = 'panel-button';
    addWeaponBtn.textContent = 'Add Weapon';
    addWeaponBtn.addEventListener('click', () => {
      if (this.selectedEntity && this.inventoryComponent) {
        const weapon = setupWeaponEntity(this.selectedEntity, 'rifle');
        this.inventoryComponent.addWeapon(weapon);
        this.refresh();
        this.config.onConfigChanged?.();
        this.config.updateSceneBuffers?.();
      }
    });
    section.appendChild(addWeaponBtn);

    return section;
  }

  /**
   * Creates preset selector
   */
  private createPresetSelector(currentPreset: WeaponPresetType | null): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const label = document.createElement('label');
    label.className = 'panel-label';
    label.textContent = 'Weapon Preset';
    section.appendChild(label);

    const select = document.createElement('select');
    select.className = 'panel-select';
    select.value = currentPreset ?? 'custom';

    const presets: WeaponPresetType[] = ['rifle', 'shotgun', 'sniper', 'pistol', 'smg', 'custom'];
    for (const preset of presets) {
      const option = document.createElement('option');
      option.value = preset;
      option.textContent = preset.charAt(0).toUpperCase() + preset.slice(1);
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      if (this.selectedEntity && select.value !== currentPreset) {
        const preset = select.value as WeaponPresetType;
        
        // Validate preset value
        const validPresets: WeaponPresetType[] = ['rifle', 'shotgun', 'sniper', 'pistol', 'smg', 'custom'];
        if (!validPresets.includes(preset)) {
          console.warn(`Invalid weapon preset: ${preset}`);
          select.value = currentPreset ?? 'custom';
          return;
        }
        
        // Store previous state for undo
        const oldWeapon = this.selectedEntity.getComponent(WeaponComponent);
        const oldPreset = oldWeapon?.weaponPreset ?? null;
        
        // Remove old weapon component if exists
        if (oldWeapon) {
          this.selectedEntity.removeComponent(WeaponComponent);
        }
        
        // Create new weapon with preset
        setupWeaponEntity(this.selectedEntity, preset);
        
        // Register undo action
        if (this.config.registerUndo && oldPreset !== null) {
          this.config.registerUndo(() => {
            const currentWeapon = this.selectedEntity?.getComponent(WeaponComponent);
            if (currentWeapon && this.selectedEntity) {
              this.selectedEntity.removeComponent(WeaponComponent);
              setupWeaponEntity(this.selectedEntity, oldPreset);
              this.refresh();
              this.config.onConfigChanged?.();
              this.config.updateSceneBuffers?.();
            }
          });
        }
        
        this.refresh();
        this.config.onConfigChanged?.();
        this.config.updateSceneBuffers?.();
      }
    });

    section.appendChild(select);
    return section;
  }

  /**
   * Creates stats display section
   */
  private createStatsSection(): HTMLElement {
    const section = this.createSection('Analytics & Effective Stats');

    if (!this.weaponComponent || !this.selectedEntity) {
      return section;
    }

    const stats = getEffectiveWeaponStats(this.selectedEntity);
    if (!stats) {
      const noStats = document.createElement('div');
      noStats.className = 'panel-info';
      noStats.textContent = 'No weapon stats available';
      section.appendChild(noStats);
      return section;
    }

    // DPS Calculation
    const rawDps = stats.damage * stats.fireRate;
    
    // Sustained DPS
    // Time to empty mag = maxAmmo / fireRate
    // Cycle time = time to empty + reloadDuration
    const timeToEmpty = stats.maxAmmo / stats.fireRate;
    const cycleTime = timeToEmpty + stats.reloadDuration;
    const damagePerCycle = stats.maxAmmo * stats.damage;
    const sustainedDps = damagePerCycle / cycleTime;

    const statsList = document.createElement('div');
    statsList.className = 'stats-list';

    const statRow = (label: string, value: string | number, highlight = false) => {
      const row = document.createElement('div');
      row.className = 'stat-row';
      if (highlight) {
        row.style.fontWeight = 'bold';
        row.style.color = 'var(--color-accent, #4da6ff)';
        row.style.marginTop = '4px';
        row.style.marginBottom = '4px';
      }
      
      const labelEl = document.createElement('span');
      labelEl.className = 'stat-label';
      labelEl.textContent = label;
      
      const valueEl = document.createElement('span');
      valueEl.className = 'stat-value';
      valueEl.textContent = String(value);
      
      row.appendChild(labelEl);
      row.appendChild(valueEl);
      return row;
    };

    // DPS Stats
    statsList.appendChild(statRow('Raw DPS', rawDps.toFixed(1), true));
    statsList.appendChild(statRow('Sustained DPS', sustainedDps.toFixed(1), true));
    
    // Separator
    const separator = document.createElement('div');
    separator.style.height = '1px';
    separator.style.backgroundColor = 'var(--color-border, #333)';
    separator.style.margin = '8px 0';
    statsList.appendChild(separator);

    statsList.appendChild(statRow('Damage', stats.damage.toFixed(1)));
    statsList.appendChild(statRow('Fire Rate', stats.fireRate.toFixed(1)));
    statsList.appendChild(statRow('Range', stats.range.toFixed(1)));
    statsList.appendChild(statRow('Spread', (stats.spread * 100).toFixed(1) + '%'));
    statsList.appendChild(statRow('Max Ammo', stats.maxAmmo));
    statsList.appendChild(statRow('Reload Time', stats.reloadDuration.toFixed(1) + 's'));

    section.appendChild(statsList);

    // Spread Visualizer
    const visualizer = this.createSpreadVisualizer(stats.range, stats.spread);
    section.appendChild(visualizer);

    return section;
  }

  /**
   * Creates spread visualization canvas
   */
  private createSpreadVisualizer(range: number, spread: number): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.marginTop = '12px';
    wrapper.style.backgroundColor = '#111';
    wrapper.style.border = '1px solid var(--color-border, #333)';
    wrapper.style.borderRadius = '4px';
    wrapper.style.padding = '8px';
    
    const label = document.createElement('div');
    label.className = 'panel-label-small';
    label.textContent = 'Spread Visualization (Top-Down)';
    label.style.marginBottom = '4px';
    wrapper.appendChild(label);

    const canvas = document.createElement('canvas');
    const width = 280;
    const height = 140;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.display = 'block';
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Clear background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      
      // Calculate drawing scales
      // Max range to display = 100m or provided range if larger
      const maxDisplayRange = Math.max(50, range * 1.1);
      const scaleX = (width - 20) / maxDisplayRange;
      const startX = 10;
      const centerY = height / 2;

      // Draw grid lines (every 10m)
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      for (let r = 10; r < maxDisplayRange; r += 10) {
        const x = startX + r * scaleX;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Draw effective range line
      const rangeX = startX + range * scaleX;
      ctx.strokeStyle = '#d44';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(rangeX, 0);
      ctx.lineTo(rangeX, height);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw range label
      ctx.fillStyle = '#d44';
      ctx.font = '10px monospace';
      ctx.fillText(`${range.toFixed(0)}m`, rangeX - 25, height - 5);

      // Draw spread cone
      ctx.fillStyle = 'rgba(77, 166, 255, 0.2)';
      ctx.strokeStyle = 'rgba(77, 166, 255, 0.6)';
      ctx.beginPath();
      ctx.moveTo(startX, centerY);
      
      // Calculate spread points at range
      // Spread is typically half-angle in game engines, but let's assume it's full spread or half depending on implementation.
      // WeaponComponent says "Spread angle in radians". Usually this is the deviation from center.
      // So total cone angle is 2 * spread.
      
      const coneLength = Math.min(range, maxDisplayRange);
      const coneEndX = startX + coneLength * scaleX;
      
      // Width at distance d = d * tan(spread)
      // We need to scale Y as well. Let's say height represents 20m width?
      const metersPerPixelY = 20 / height;
      
      const spreadWidthMeters = coneLength * Math.tan(spread);
      const spreadPixelsY = spreadWidthMeters / metersPerPixelY;
      
      ctx.lineTo(coneEndX, centerY - spreadPixelsY);
      ctx.lineTo(coneEndX, centerY + spreadPixelsY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw center line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.moveTo(startX, centerY);
      ctx.lineTo(coneEndX, centerY);
      ctx.stroke();
    }

    wrapper.appendChild(canvas);
    return wrapper;
  }

  /**
   * Creates attachments section
   */
  private createAttachmentsSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    if (!this.selectedEntity) {
      return section;
    }

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Attachments';
    section.appendChild(title);

    const attachmentComp = this.selectedEntity.getComponent(AttachmentComponent);
    const currentAttachments = attachmentComp ? attachmentComp.getAllAttachments() : [];

    // Show current attachments
    if (currentAttachments.length > 0) {
      const currentList = document.createElement('div');
      currentList.className = 'attachment-list';

      for (const attachment of currentAttachments) {
        const item = document.createElement('div');
        item.className = 'attachment-item';

        const name = document.createElement('span');
        name.textContent = attachment.name;
        item.appendChild(name);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'panel-button-small panel-button-danger';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => {
          removeAttachment(this.selectedEntity!, attachment.type);
          this.refresh();
          this.config.onConfigChanged?.();
          this.config.updateSceneBuffers?.();
        });
        item.appendChild(removeBtn);

        currentList.appendChild(item);
      }

      section.appendChild(currentList);
    }

    // Add attachment selector
    const addSection = document.createElement('div');
    addSection.className = 'panel-input-group';

    const addLabel = document.createElement('label');
    addLabel.className = 'panel-label-small';
    addLabel.textContent = 'Add Attachment';
    addSection.appendChild(addLabel);

    const addSelect = document.createElement('select');
    addSelect.className = 'panel-select';
    addSelect.innerHTML = '<option value="">Select attachment...</option>';

    const allAttachments = getAllAttachmentIds();
    for (const attId of allAttachments) {
      const att = getAttachment(attId);
      if (att) {
        const option = document.createElement('option');
        option.value = attId;
        option.textContent = `${att.name} (${att.type})`;
        addSelect.appendChild(option);
      }
    }

    addSelect.addEventListener('change', () => {
      if (addSelect.value && this.selectedEntity) {
        addAttachment(this.selectedEntity, addSelect.value);
        addSelect.value = '';
        this.refresh();
        this.config.onConfigChanged?.();
        this.config.updateSceneBuffers?.();
      }
    });

    addSection.appendChild(addSelect);
    section.appendChild(addSection);

    return section;
  }

  /**
   * Creates ammo configuration section
   */
  private createAmmoSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    if (!this.weaponComponent || !this.selectedEntity) {
      return section;
    }

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Ammunition';
    section.appendChild(title);

    // Current ammo display
    const ammoDisplay = document.createElement('div');
    ammoDisplay.className = 'panel-info';
    ammoDisplay.textContent = `Current: ${this.weaponComponent.ammo} / ${this.weaponComponent.getEffectiveMaxAmmo()}`;
    section.appendChild(ammoDisplay);

    // Ammo type selector
    const typeLabel = document.createElement('label');
    typeLabel.className = 'panel-label';
    typeLabel.textContent = 'Ammo Type';
    section.appendChild(typeLabel);

    const typeSelect = document.createElement('select');
    typeSelect.className = 'panel-select';
    typeSelect.value = this.weaponComponent.currentAmmoType;

    const ammoTypes = getAllAmmoTypeNames();
    for (const ammoType of ammoTypes) {
      const ammoDef = getAmmoType(ammoType);
      const option = document.createElement('option');
      option.value = ammoType;
      option.textContent = ammoDef.name;
      typeSelect.appendChild(option);
    }

    typeSelect.addEventListener('change', () => {
      if (this.selectedEntity && this.weaponComponent) {
        const newAmmoType = typeSelect.value as AmmoType;
        
        // Validate ammo type
        const validAmmoTypes = getAllAmmoTypeNames();
        if (!validAmmoTypes.includes(newAmmoType)) {
          console.warn(`Invalid ammo type: ${newAmmoType}`);
          typeSelect.value = this.weaponComponent.currentAmmoType;
          return;
        }
        
        // Store previous state for undo
        const oldAmmoType = this.weaponComponent.currentAmmoType;
        
        changeAmmoType(this.selectedEntity, newAmmoType);
        
        // Register undo action
        if (this.config.registerUndo) {
          this.config.registerUndo(() => {
            if (this.selectedEntity) {
              changeAmmoType(this.selectedEntity, oldAmmoType);
              this.refresh();
              this.config.onConfigChanged?.();
              this.config.updateSceneBuffers?.();
            }
          });
        }
        
        this.refresh();
        this.config.onConfigChanged?.();
        this.config.updateSceneBuffers?.();
      }
    });

    section.appendChild(typeSelect);

    return section;
  }

  /**
   * Disposes the panel and cleans up resources
   */
  dispose(): void {
    // Clear polling interval if it exists
    if (this.selectionUpdateInterval !== null) {
      window.clearInterval(this.selectionUpdateInterval);
      this.selectionUpdateInterval = null;
    }
    
    // Remove selection change handler if registered
    if (this.selectionChangeHandler && typeof (this.config.selection as any).removeSelectionChanged === 'function') {
      (this.config.selection as any).removeSelectionChanged(this.selectionChangeHandler);
      this.selectionChangeHandler = null;
    }
    
    // Clear references
    this.selectedEntity = null;
    this.weaponComponent = null;
    this.inventoryComponent = null;
    
    // Remove root element from DOM if it's attached
    if (this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}

