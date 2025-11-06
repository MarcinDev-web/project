/**
 * NpcPanel - Configuration panel for NPC entities
 * 
 * Features:
 * - Configure NPC unit type and faction
 * - Set behavior/orders (idle, patrol, shoot-player, etc.)
 * - Configure army assignment
 * - Set behavior-specific parameters (waypoints, detection range, etc.)
 */

import type { AssetPreset } from '../types/BlockAssetTypes';
import { createIcon } from '../utils/icons';
import { getAllNpcUnitTypes, getAllNpcBehaviors, getAllNpcFactions } from '@engine/editor-utils';

export interface NpcPanelConfig {
  /** Current NPC asset preset (if any) */
  assetPreset: AssetPreset | null;
  /** Called when NPC configuration changes */
  onConfigChanged: (config: AssetPreset['npcConfig']) => void;
  /** Called when new NPC preset should be created */
  onCreatePreset?: (config: AssetPreset['npcConfig']) => void;
  /** Called to start placement with given preset */
  onStartPlacement?: (preset: AssetPreset) => void;
}

/**
 * NpcPanel - UI panel for configuring NPC parameters
 */
export class NpcPanel {
  private readonly root: HTMLElement;
  private config: NpcPanelConfig;
  private currentConfig: AssetPreset['npcConfig'] | null = null;

  constructor(config: NpcPanelConfig) {
    this.config = config;
    this.currentConfig = config.assetPreset?.npcConfig ?? null;

    this.root = document.createElement('div');
    this.root.className = 'npc-panel';
    this.root.setAttribute('data-tab', 'NPCs');

    this.render();
  }

  /**
   * Gets the root element
   */
  get element(): HTMLElement {
    return this.root;
  }

  /**
   * Updates the current preset
   */
  updatePreset(preset: AssetPreset | null): void {
    this.config.assetPreset = preset;
    this.currentConfig = preset?.npcConfig ?? null;
    this.render();
  }

  /**
   * Renders the NPC panel UI
   */
  private render(): void {
    this.root.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'panel-header';
    
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'panel-header-icon';
    iconWrapper.appendChild(createIcon('user', 20));
    
    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.textContent = 'NPCs';

    header.appendChild(iconWrapper);
    header.appendChild(title);
    this.root.appendChild(header);

    const content = document.createElement('div');
    content.className = 'npc-panel-content custom-scrollbar';

    // Unit Type Selector
    const unitTypeSection = this.createUnitTypeSection();
    content.appendChild(unitTypeSection);

    // Faction Selector
    const factionSection = this.createFactionSection();
    content.appendChild(factionSection);

    // Behavior Selector
    const behaviorSection = this.createBehaviorSection();
    content.appendChild(behaviorSection);

    // Army ID
    const armySection = this.createArmySection();
    content.appendChild(armySection);

    // Behavior-specific settings
    if (this.currentConfig) {
      if (this.currentConfig.behavior === 'patrol') {
        const patrolSection = this.createPatrolSection();
        content.appendChild(patrolSection);
      } else if (this.currentConfig.behavior === 'guard-position') {
        const guardSection = this.createGuardSection();
        content.appendChild(guardSection);
      } else if (this.currentConfig.behavior === 'shoot-player') {
        const detectionSection = this.createDetectionSection();
        content.appendChild(detectionSection);
      }
    }

    // Action Buttons
    const actionsSection = this.createActionsSection();
    content.appendChild(actionsSection);

    this.root.appendChild(content);
  }

  /**
   * Creates unit type selector section
   */
  private createUnitTypeSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const label = document.createElement('label');
    label.className = 'panel-label';
    label.textContent = 'Unit Type';
    section.appendChild(label);

    const select = document.createElement('select');
    select.className = 'panel-select';
    select.value = this.currentConfig?.unitType ?? 'soldier';

    const unitTypes = getAllNpcUnitTypes();
    for (const unitType of unitTypes) {
      const option = document.createElement('option');
      option.value = unitType.id;
      option.textContent = unitType.name;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      this.updateConfig({ unitType: select.value as any });
    });

    section.appendChild(select);
    return section;
  }

  /**
   * Creates faction selector section
   */
  private createFactionSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const label = document.createElement('label');
    label.className = 'panel-label';
    label.textContent = 'Faction';
    section.appendChild(label);

    const select = document.createElement('select');
    select.className = 'panel-select';
    select.value = this.currentConfig?.faction ?? 'neutral';

    const factions = getAllNpcFactions();
    for (const faction of factions) {
      const option = document.createElement('option');
      option.value = faction.id;
      option.textContent = faction.name;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      this.updateConfig({ faction: select.value as any });
    });

    section.appendChild(select);
    return section;
  }

  /**
   * Creates behavior selector section
   */
  private createBehaviorSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const label = document.createElement('label');
    label.className = 'panel-label';
    label.textContent = 'Behavior';
    section.appendChild(label);

    const select = document.createElement('select');
    select.className = 'panel-select';
    select.value = this.currentConfig?.behavior ?? 'idle';

    const behaviors = getAllNpcBehaviors();
    for (const behavior of behaviors) {
      const option = document.createElement('option');
      option.value = behavior.id;
      option.textContent = behavior.name;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      this.updateConfig({ behavior: select.value as any });
      // Re-render to show behavior-specific sections
      this.render();
    });

    section.appendChild(select);
    return section;
  }

  /**
   * Creates army ID section
   */
  private createArmySection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const label = document.createElement('label');
    label.className = 'panel-label';
    label.textContent = 'Army ID (optional)';
    section.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'panel-input';
    input.placeholder = 'e.g., army-1, red-team';
    input.value = this.currentConfig?.armyId ?? '';

    input.addEventListener('input', () => {
      this.updateConfig({ armyId: input.value.trim() || undefined });
    });

    section.appendChild(input);
    return section;
  }

  /**
   * Creates patrol settings section
   */
  private createPatrolSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Patrol Settings';
    section.appendChild(title);

    // Patrol Speed
    const speedWrapper = document.createElement('div');
    speedWrapper.className = 'panel-input-group';

    const speedLabel = document.createElement('label');
    speedLabel.className = 'panel-label-small';
    speedLabel.textContent = 'Patrol Speed';
    speedWrapper.appendChild(speedLabel);

    const speedInput = document.createElement('input');
    speedInput.type = 'number';
    speedInput.min = '0.5';
    speedInput.max = '10';
    speedInput.step = '0.5';
    speedInput.value = String(this.currentConfig?.patrolSpeed ?? 3.0);
    speedInput.className = 'panel-input';

    speedInput.addEventListener('input', () => {
      const value = parseFloat(speedInput.value);
      if (!isNaN(value)) {
        this.updateConfig({ patrolSpeed: value });
      }
    });

    speedWrapper.appendChild(speedInput);
    section.appendChild(speedWrapper);

    // Waypoints info (read-only for now, could be extended with waypoint editor)
    const waypointsInfo = document.createElement('div');
    waypointsInfo.className = 'panel-info';
    waypointsInfo.textContent = 'Waypoints can be configured in the Properties panel after placement.';
    section.appendChild(waypointsInfo);

    return section;
  }

  /**
   * Creates guard position settings section
   */
  private createGuardSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Guard Settings';
    section.appendChild(title);

    // Guard Radius
    const radiusWrapper = document.createElement('div');
    radiusWrapper.className = 'panel-input-group';

    const radiusLabel = document.createElement('label');
    radiusLabel.className = 'panel-label-small';
    radiusLabel.textContent = 'Guard Radius';
    radiusWrapper.appendChild(radiusLabel);

    const radiusInput = document.createElement('input');
    radiusInput.type = 'number';
    radiusInput.min = '1';
    radiusInput.max = '50';
    radiusInput.step = '1';
    radiusInput.value = String(this.currentConfig?.guardRadius ?? 5.0);
    radiusInput.className = 'panel-input';

    radiusInput.addEventListener('input', () => {
      const value = parseFloat(radiusInput.value);
      if (!isNaN(value)) {
        this.updateConfig({ guardRadius: value });
      }
    });

    radiusWrapper.appendChild(radiusInput);
    section.appendChild(radiusWrapper);

    const guardInfo = document.createElement('div');
    guardInfo.className = 'panel-info';
    guardInfo.textContent = 'Guard position will be set at placement location.';
    section.appendChild(guardInfo);

    return section;
  }

  /**
   * Creates detection range section (for shoot-player behavior)
   */
  private createDetectionSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Combat Settings';
    section.appendChild(title);

    // Detection Range
    const rangeWrapper = document.createElement('div');
    rangeWrapper.className = 'panel-input-group';

    const rangeLabel = document.createElement('label');
    rangeLabel.className = 'panel-label-small';
    rangeLabel.textContent = 'Detection Range';
    rangeWrapper.appendChild(rangeLabel);

    const rangeInput = document.createElement('input');
    rangeInput.type = 'number';
    rangeInput.min = '5';
    rangeInput.max = '100';
    rangeInput.step = '5';
    rangeInput.value = String(this.currentConfig?.detectionRange ?? 20.0);
    rangeInput.className = 'panel-input';

    rangeInput.addEventListener('input', () => {
      const value = parseFloat(rangeInput.value);
      if (!isNaN(value)) {
        this.updateConfig({ detectionRange: value });
      }
    });

    rangeWrapper.appendChild(rangeInput);
    section.appendChild(rangeWrapper);

    return section;
  }

  /**
   * Creates action buttons section
   */
  private createActionsSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    // Create Preset button
    if (this.config.onCreatePreset) {
      const createBtn = document.createElement('button');
      createBtn.className = 'panel-button';
      createBtn.textContent = 'Create Preset';
      createBtn.addEventListener('click', () => {
        if (this.currentConfig && this.config.onCreatePreset) {
          this.config.onCreatePreset(this.currentConfig);
        }
      });
      section.appendChild(createBtn);
    }

    // Start Placement button
    if (this.config.onStartPlacement) {
      const placeBtn = document.createElement('button');
      placeBtn.className = 'panel-button panel-button-primary';
      placeBtn.textContent = 'Start Placement';
      placeBtn.addEventListener('click', () => {
        // Create preset with current config if not exists
        const preset = this.config.assetPreset ?? this.createDefaultPreset();
        if (!preset.npcConfig) {
          preset.npcConfig = this.currentConfig ?? {
            unitType: 'soldier',
            faction: 'neutral',
            behavior: 'idle',
          };
        } else {
          // Update existing config
          preset.npcConfig = {
            ...preset.npcConfig,
            ...this.currentConfig,
          };
        }
        this.config.onStartPlacement(preset);
      });
      section.appendChild(placeBtn);
    }

    return section;
  }

  /**
   * Updates the configuration
   */
  private updateConfig(updates: Partial<AssetPreset['npcConfig']>): void {
    this.currentConfig = {
      unitType: 'soldier',
      faction: 'neutral',
      behavior: 'idle',
      ...this.currentConfig,
      ...updates,
    };
    this.config.onConfigChanged(this.currentConfig);
    
    // Update asset preset if it exists
    if (this.config.assetPreset) {
      this.config.assetPreset.npcConfig = this.currentConfig;
    }
  }

  /**
   * Creates a default NPC preset for placement
   */
  createDefaultPreset(): AssetPreset {
    return {
      name: 'NPC',
      scale: [1, 1, 1],
      color: [0.5, 0.5, 0.5, 1],
      npcConfig: {
        unitType: 'soldier',
        faction: 'neutral',
        behavior: 'idle',
      },
    };
  }
}

