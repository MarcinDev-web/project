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
import { AmmoComponent } from '@engine/world/components/AmmoComponent';
import {
  setupWeaponEntity,
  setupInventory,
  addAttachment,
  removeAttachment,
  changeAmmoType,
  getEffectiveWeaponStats,
  getAllAttachmentIds,
  getAvailableAttachmentsByType,
  getAllAmmoTypeNames,
  WeaponLoadouts,
  setupPvPLoadout,
} from '@engine/world/utils';
import type { WeaponPresetType, AttachmentType, AmmoType } from '@engine/world/types/weapon';
import { getAttachment } from '@engine/world/data/attachments';
import { getAmmoType } from '@engine/world/data/ammo';
import { createIcon } from '../utils/icons';

export interface WeaponPanelConfig {
  /** Selection manager */
  selection: SelectionManager;
  /** Scene for creating entities */
  scene: any;
  /** Called when weapon configuration changes */
  onConfigChanged?: () => void;
  /** Called to update scene buffers */
  updateSceneBuffers?: () => void;
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
      
      // Initial update
      updateSelection();
      
      // Subscribe to selection changes (if available)
      if (typeof (config.selection as any).onSelectionChanged === 'function') {
        (config.selection as any).onSelectionChanged(updateSelection);
      } else {
        // Fallback: poll or use event system
        const interval = setInterval(() => {
          const current = config.selection.primarySelection;
          if (current !== this.selectedEntity) {
            updateSelection();
          }
        }, 100);
        
        // Cleanup would be handled by dispose if we add it
        (this.root as any)._cleanupInterval = interval;
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

    // Base stats (read-only display)
    const statsSection = this.createStatsSection();
    section.appendChild(statsSection);

    // Attachments
    const attachmentsSection = this.createAttachmentsSection();
    section.appendChild(attachmentsSection);

    // Ammo configuration
    const ammoSection = this.createAmmoSection();
    section.appendChild(ammoSection);

    return section;
  }

  /**
   * Creates inventory configuration section
   */
  private createInventorySection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    if (!this.inventoryComponent || !this.selectedEntity) {
      return section;
    }

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Weapon Inventory';
    section.appendChild(title);

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
          // Switch weapon (would need current time from system)
          this.config.onConfigChanged?.();
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
        // Remove old weapon component if exists
        const oldWeapon = this.selectedEntity.getComponent(WeaponComponent);
        if (oldWeapon) {
          this.selectedEntity.removeComponent(WeaponComponent);
        }
        // Create new weapon with preset
        setupWeaponEntity(this.selectedEntity, preset);
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
    const section = document.createElement('div');
    section.className = 'panel-section';

    if (!this.weaponComponent || !this.selectedEntity) {
      return section;
    }

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Effective Stats';
    section.appendChild(title);

    const stats = getEffectiveWeaponStats(this.selectedEntity);
    if (!stats) {
      const noStats = document.createElement('div');
      noStats.className = 'panel-info';
      noStats.textContent = 'No weapon stats available';
      section.appendChild(noStats);
      return section;
    }

    const statsList = document.createElement('div');
    statsList.className = 'stats-list';

    const statRow = (label: string, value: string | number) => {
      const row = document.createElement('div');
      row.className = 'stat-row';
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

    statsList.appendChild(statRow('Damage', stats.damage.toFixed(1)));
    statsList.appendChild(statRow('Fire Rate', stats.fireRate.toFixed(1)));
    statsList.appendChild(statRow('Range', stats.range.toFixed(1)));
    statsList.appendChild(statRow('Spread', (stats.spread * 100).toFixed(1) + '%'));
    statsList.appendChild(statRow('Max Ammo', stats.maxAmmo));
    statsList.appendChild(statRow('Reload Time', stats.reloadDuration.toFixed(1) + 's'));

    section.appendChild(statsList);
    return section;
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
    const currentAttachments = attachmentComp ? attachmentComp.getAttachments() : [];

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
      if (this.selectedEntity) {
        changeAmmoType(this.selectedEntity, typeSelect.value as AmmoType);
        this.refresh();
        this.config.onConfigChanged?.();
        this.config.updateSceneBuffers?.();
      }
    });

    section.appendChild(typeSelect);

    return section;
  }
}

