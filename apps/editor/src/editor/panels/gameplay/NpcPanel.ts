/**
 * NpcPanel - Configuration panel for NPC entities
 * 
 * Features:
 * - Configure NPC unit type and faction
 * - Set behavior/orders (idle, patrol, shoot-player, etc.)
 * - Configure army assignment
 * - Set behavior-specific parameters (waypoints, detection range, etc.)
 */

import type { AssetPreset } from '../../types/BlockAssetTypes';
import { createIcon } from '../../utils/icons';
import { getAllNpcUnitTypes, getAllNpcBehaviors, getAllNpcFactions } from '@engine/editor-utils';

type NpcConfig = NonNullable<AssetPreset['npcConfig']>;
type NpcConfigUpdates = {
  [K in keyof NpcConfig]?: NpcConfig[K] | undefined;
};

export interface NpcPanelConfig {
  /** Current NPC asset preset (if any) */
  assetPreset: AssetPreset | null;
  /** Called when NPC configuration changes */
  onConfigChanged: (config: AssetPreset['npcConfig']) => void;
  /** Called when new NPC preset should be created */
  onCreatePreset?: (config: AssetPreset['npcConfig']) => void;
  /** Called to start placement with given preset */
  onStartPlacement?: (preset: AssetPreset) => void;
  /** Optional undo registration callback */
  registerUndo?: (action: () => void) => void;
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
      const unitTypes = getAllNpcUnitTypes();
      const isValid = unitTypes.some(ut => ut.id === select.value);
      if (!isValid) {
        console.warn(`Invalid unit type: ${select.value}`);
        select.value = this.currentConfig?.unitType ?? 'soldier';
        return;
      }
      const prevValue = this.currentConfig?.unitType ?? 'soldier';
      this.updateConfig({ unitType: select.value as any }, prevValue !== select.value ? () => {
        this.updateConfig({ unitType: prevValue });
      } : undefined);
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
      const factions = getAllNpcFactions();
      const isValid = factions.some(f => f.id === select.value);
      if (!isValid) {
        console.warn(`Invalid faction: ${select.value}`);
        select.value = this.currentConfig?.faction ?? 'neutral';
        return;
      }
      const prevValue = this.currentConfig?.faction ?? 'neutral';
      this.updateConfig({ faction: select.value as any }, prevValue !== select.value ? () => {
        this.updateConfig({ faction: prevValue });
      } : undefined);
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
      const behaviors = getAllNpcBehaviors();
      const isValid = behaviors.some(b => b.id === select.value);
      if (!isValid) {
        console.warn(`Invalid behavior: ${select.value}`);
        select.value = this.currentConfig?.behavior ?? 'idle';
        return;
      }
      const prevValue = this.currentConfig?.behavior ?? 'idle';
      this.updateConfig({ behavior: select.value as any }, prevValue !== select.value ? () => {
        this.updateConfig({ behavior: prevValue });
        this.render();
      } : undefined);
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
      const trimmed = input.value.trim();
      // Validate army ID (alphanumeric, dashes, underscores)
      const isValid = trimmed === '' || /^[a-zA-Z0-9_-]+$/.test(trimmed);
      if (!isValid) {
        console.warn('Invalid army ID format (alphanumeric, dashes, underscores only)');
        return;
      }
      const prevValue = this.currentConfig?.armyId ?? undefined;
      this.updateConfig({ armyId: trimmed || undefined }, prevValue !== trimmed ? () => {
        this.updateConfig({ armyId: prevValue });
      } : undefined);
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
      const clamped = Math.max(0.5, Math.min(10, isNaN(value) ? 3.0 : value));
      const prevValue = this.currentConfig?.patrolSpeed ?? 3.0;
      this.updateConfig({ patrolSpeed: clamped }, prevValue !== clamped ? () => {
        this.updateConfig({ patrolSpeed: prevValue });
      } : undefined);
      // Update input value if clamped
      if (clamped !== value && !isNaN(value)) {
        speedInput.value = String(clamped);
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
      const clamped = Math.max(1, Math.min(50, isNaN(value) ? 5.0 : value));
      const prevValue = this.currentConfig?.guardRadius ?? 5.0;
      this.updateConfig({ guardRadius: clamped }, prevValue !== clamped ? () => {
        this.updateConfig({ guardRadius: prevValue });
      } : undefined);
      // Update input value if clamped
      if (clamped !== value && !isNaN(value)) {
        radiusInput.value = String(clamped);
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
      const clamped = Math.max(5, Math.min(100, isNaN(value) ? 20.0 : value));
      const prevValue = this.currentConfig?.detectionRange ?? 20.0;
      this.updateConfig({ detectionRange: clamped }, prevValue !== clamped ? () => {
        this.updateConfig({ detectionRange: prevValue });
      } : undefined);
      // Update input value if clamped
      if (clamped !== value && !isNaN(value)) {
        rangeInput.value = String(clamped);
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
        this.config.onStartPlacement?.(preset);
      });
      section.appendChild(placeBtn);
    }

    return section;
  }

  /**
   * Updates the configuration
   */
  private updateConfig(updates: NpcConfigUpdates, undoAction?: () => void): void {
    const prevConfig = this.currentConfig ? { ...this.currentConfig } : null;
    
    const mutableConfig: Partial<NpcConfig> = {
      unitType: 'soldier',
      faction: 'neutral',
      behavior: 'idle',
      ...(this.currentConfig ?? {}),
    };
    const target = mutableConfig as Record<keyof NpcConfig, NpcConfig[keyof NpcConfig] | undefined>;
    for (const [key, value] of Object.entries(updates) as Array<[keyof NpcConfig, NpcConfig[keyof NpcConfig] | undefined]>) {
      if (value === undefined) {
        delete target[key];
      } else {
        target[key] = value;
      }
    }
    this.currentConfig = mutableConfig as NpcConfig;
    
    // Register undo action if provided
    if (undoAction && this.config.registerUndo && prevConfig) {
      this.config.registerUndo(() => {
        this.currentConfig = prevConfig;
        this.config.onConfigChanged(this.currentConfig);
        // Update asset preset if it exists
        if (this.config.assetPreset) {
          this.config.assetPreset.npcConfig = this.currentConfig;
        }
      });
    }
    
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

