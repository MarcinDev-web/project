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
import { 
  getAllNpcUnitTypes, 
  getAllNpcBehaviors, 
  getAllNpcFactions,
  getNpcUnitType
} from '@engine/editor-utils';
import type { Scene } from '@engine/world';
import { CameraComponent } from '@engine/world/components/CameraComponent';

type NpcConfig = NonNullable<AssetPreset['npcConfig']>;
type NpcConfigUpdates = {
  [K in keyof NpcConfig]?: NpcConfig[K] | undefined;
};

export interface NpcPanelConfig {
  /** Current NPC asset preset (if any) */
  assetPreset: AssetPreset | null;
  /** Scene instance for capturing positions */
  scene?: Scene;
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

    this.renderHeader();

    const content = document.createElement('div');
    content.className = 'npc-panel-content custom-scrollbar';

    // Unit Type Selector
    content.appendChild(this.createUnitTypeSection());

    // Faction Selector
    content.appendChild(this.createFactionSection());

    // Equipment (Combat units)
    if (['soldier', 'guard', 'custom'].includes(this.currentConfig?.unitType ?? 'soldier')) {
      content.appendChild(this.createEquipmentSection());
    }

    // Attributes (Health, Speed)
    content.appendChild(this.createAttributesSection());

    // Behavior Selector
    content.appendChild(this.createBehaviorSection());

    // Army ID
    content.appendChild(this.createArmySection());

    // Behavior-specific settings
    if (this.currentConfig) {
      this.renderBehaviorSpecifics(content);
    }

    // Action Buttons
    content.appendChild(this.createActionsSection());

    this.root.appendChild(content);
  }

  private renderHeader(): void {
    const header = document.createElement('div');
    header.className = 'panel-header';
    
    const unitType = getNpcUnitType((this.currentConfig?.unitType ?? 'soldier') as any);
    const faction = getAllNpcFactions().find(f => f.id === (this.currentConfig?.faction ?? 'neutral'));
    
    // Apply faction color if available
    if (faction?.color) {
      const [r, g, b] = faction.color;
      header.style.borderLeft = `4px solid rgb(${r * 255}, ${g * 255}, ${b * 255})`;
    }
    
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'panel-header-icon';
    // Dynamic icon based on unit type if possible, otherwise generic user
    const iconName = unitType?.id === 'guard' ? 'shield-check' : 'user';
    iconWrapper.appendChild(createIcon(iconName, 20));
    
    const titleWrapper = document.createElement('div');
    titleWrapper.style.display = 'flex';
    titleWrapper.style.flexDirection = 'column';
    titleWrapper.style.justifyContent = 'center';
    
    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.textContent = unitType?.name ?? 'NPC';
    titleWrapper.appendChild(title);

    if (faction) {
        const subtitle = document.createElement('div');
        subtitle.style.fontSize = '11px';
        subtitle.style.opacity = '0.7';
        subtitle.textContent = faction.name;
        titleWrapper.appendChild(subtitle);
    }

    header.appendChild(iconWrapper);
    header.appendChild(titleWrapper);
    this.root.appendChild(header);
  }

  private renderBehaviorSpecifics(content: HTMLElement): void {
    if (!this.currentConfig) return;

    if (this.currentConfig.behavior === 'patrol') {
      content.appendChild(this.createPatrolSection());
    } else if (this.currentConfig.behavior === 'guard-position') {
      content.appendChild(this.createGuardSection());
    } else if (this.currentConfig.behavior === 'shoot-player') {
      content.appendChild(this.createDetectionSection());
    }
  }

  /**
   * Helper to create a tooltip icon
   */
  private createTooltip(text: string): HTMLElement {
    const icon = createIcon('info', 14);
    icon.style.marginLeft = '8px';
    icon.style.opacity = '0.6';
    icon.style.cursor = 'help';
    icon.title = text;
    return icon;
  }

  /**
   * Creates unit type selector section
   */
  private createUnitTypeSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const labelContainer = document.createElement('div');
    labelContainer.style.display = 'flex';
    labelContainer.style.alignItems = 'center';
    labelContainer.style.marginBottom = '4px';

    const label = document.createElement('label');
    label.className = 'panel-label';
    label.textContent = 'Unit Type';
    label.style.marginBottom = '0';
    labelContainer.appendChild(label);

    const currentUnit = getAllNpcUnitTypes().find(u => u.id === (this.currentConfig?.unitType ?? 'soldier'));
    if (currentUnit) {
        labelContainer.appendChild(this.createTooltip(currentUnit.description));
    }

    section.appendChild(labelContainer);

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

    const labelContainer = document.createElement('div');
    labelContainer.style.display = 'flex';
    labelContainer.style.alignItems = 'center';
    labelContainer.style.marginBottom = '4px';

    const label = document.createElement('label');
    label.className = 'panel-label';
    label.textContent = 'Faction';
    label.style.marginBottom = '0';
    labelContainer.appendChild(label);

    const currentFaction = getAllNpcFactions().find(f => f.id === (this.currentConfig?.faction ?? 'neutral'));
    if (currentFaction) {
        labelContainer.appendChild(this.createTooltip(currentFaction.description));
    }

    section.appendChild(labelContainer);

    const select = document.createElement('select');
    select.className = 'panel-select';
    select.value = this.currentConfig?.faction ?? 'neutral';

    const factions = getAllNpcFactions();
    for (const faction of factions) {
      const option = document.createElement('option');
      option.value = faction.id;
      option.textContent = faction.name;
      if (faction.color) {
        // Note: option styling is limited in some browsers
        option.style.color = `rgb(${faction.color.map(c => c*255).join(',')})`;
      }
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      const prevValue = this.currentConfig?.faction ?? 'neutral';
      this.updateConfig({ faction: select.value as any }, prevValue !== select.value ? () => {
        this.updateConfig({ faction: prevValue });
      } : undefined);
    });

    section.appendChild(select);
    return section;
  }

  /**
   * Creates equipment selector section
   */
  private createEquipmentSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const labelContainer = document.createElement('div');
    labelContainer.style.display = 'flex';
    labelContainer.style.alignItems = 'center';
    labelContainer.style.marginBottom = '4px';

    const label = document.createElement('label');
    label.className = 'panel-label';
    label.textContent = 'Equipment';
    label.style.marginBottom = '0';
    labelContainer.appendChild(label);
    labelContainer.appendChild(this.createTooltip('Initial weapon equipped by the NPC'));

    section.appendChild(labelContainer);

    const select = document.createElement('select');
    select.className = 'panel-select';
    
    const unitType = getNpcUnitType((this.currentConfig?.unitType ?? 'soldier') as any);
    const currentEquipment = this.currentConfig?.equipment ?? unitType?.defaultWeapon ?? 'rifle';
    select.value = currentEquipment;

    const weapons = ['rifle', 'shotgun', 'sniper', 'pistol', 'smg', 'none'];
    for (const weapon of weapons) {
      const option = document.createElement('option');
      option.value = weapon;
      option.textContent = weapon.charAt(0).toUpperCase() + weapon.slice(1);
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      const prevValue = this.currentConfig?.equipment;
      const newValue = select.value === 'none' ? undefined : select.value;
      
      this.updateConfig({ equipment: newValue }, prevValue !== newValue ? () => {
        this.updateConfig({ equipment: prevValue });
      } : undefined);
    });

    section.appendChild(select);
    return section;
  }

  /**
   * Creates attributes configuration section
   */
  private createAttributesSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const title = document.createElement('h3');
    title.className = 'panel-section-title';
    title.textContent = 'Attributes';
    section.appendChild(title);

    const unitType = getNpcUnitType((this.currentConfig?.unitType ?? 'soldier') as any);
    
    // Helper to create attribute row
    const createAttributeRow = (
      name: string, 
      key: 'health' | 'speed', 
      defaultValue: number,
      min: number,
      max: number
    ) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'panel-input-group';
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '8px';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.currentConfig?.[key] !== undefined;
      
      const label = document.createElement('label');
      label.className = 'panel-label-small';
      label.style.flex = '1';
      label.textContent = name;
      label.style.marginBottom = '0';

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'panel-input';
      input.style.width = '80px';
      input.min = String(min);
      input.max = String(max);
      input.value = String(this.currentConfig?.[key] ?? defaultValue);
      input.disabled = !checkbox.checked;

      checkbox.addEventListener('change', () => {
        input.disabled = !checkbox.checked;
        if (checkbox.checked) {
          const val = parseFloat(input.value);
          this.updateConfig({ [key]: val });
        } else {
          this.updateConfig({ [key]: undefined });
          input.value = String(defaultValue);
        }
      });

      input.addEventListener('change', () => {
        const val = parseFloat(input.value);
        if (isNaN(val) || val < min) {
          input.value = String(defaultValue);
          return;
        }
        this.updateConfig({ [key]: val });
      });

      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      return wrapper;
    };

    section.appendChild(createAttributeRow('Health', 'health', unitType?.defaultHealth ?? 100, 1, 1000));
    section.appendChild(createAttributeRow('Speed', 'speed', unitType?.defaultSpeed ?? 5, 1, 20));

    return section;
  }

  /**
   * Creates behavior selector section
   */
  private createBehaviorSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'panel-section';

    const labelContainer = document.createElement('div');
    labelContainer.style.display = 'flex';
    labelContainer.style.alignItems = 'center';
    labelContainer.style.marginBottom = '4px';

    const label = document.createElement('label');
    label.className = 'panel-label';
    label.textContent = 'Behavior';
    label.style.marginBottom = '0';
    labelContainer.appendChild(label);

    const currentBehavior = getAllNpcBehaviors().find(b => b.id === (this.currentConfig?.behavior ?? 'idle'));
    if (currentBehavior) {
        labelContainer.appendChild(this.createTooltip(currentBehavior.description));
    }

    section.appendChild(labelContainer);

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

    const errorMsg = document.createElement('div');
    errorMsg.className = 'panel-error-message';
    errorMsg.style.color = '#ff4444';
    errorMsg.style.fontSize = '12px';
    errorMsg.style.marginTop = '4px';
    errorMsg.style.display = 'none';
    errorMsg.textContent = 'Invalid format (alphanumeric, -, _ only)';

    input.addEventListener('input', () => {
      const trimmed = input.value.trim();
      // Validate army ID (alphanumeric, dashes, underscores)
      const isValid = trimmed === '' || /^[a-zA-Z0-9_-]+$/.test(trimmed);
      
      if (!isValid) {
        input.style.borderColor = '#ff4444';
        errorMsg.style.display = 'block';
        return;
      }
      
      input.style.borderColor = '';
      errorMsg.style.display = 'none';

      const prevValue = this.currentConfig?.armyId ?? undefined;
      this.updateConfig({ armyId: trimmed || undefined }, prevValue !== trimmed ? () => {
        this.updateConfig({ armyId: prevValue });
      } : undefined);
    });

    section.appendChild(input);
    section.appendChild(errorMsg);
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
      
      if (clamped !== value && !isNaN(value)) {
        speedInput.value = String(clamped);
      }
    });

    speedWrapper.appendChild(speedInput);
    section.appendChild(speedWrapper);

    // Waypoints List
    const waypointsTitle = document.createElement('label');
    waypointsTitle.className = 'panel-label-small';
    waypointsTitle.textContent = 'Waypoints';
    waypointsTitle.style.marginTop = '8px';
    waypointsTitle.style.marginBottom = '4px';
    section.appendChild(waypointsTitle);

    const waypointsList = document.createElement('div');
    waypointsList.className = 'waypoints-list';
    waypointsList.style.display = 'flex';
    waypointsList.style.flexDirection = 'column';
    waypointsList.style.gap = '4px';
    waypointsList.style.marginBottom = '8px';

    const waypoints = this.currentConfig?.patrolWaypoints ?? [];

    const updateWaypoints = (newWaypoints: Array<[number, number, number]>) => {
        this.updateConfig({ patrolWaypoints: newWaypoints });
        this.render(); // Re-render to update list
    };

    waypoints.forEach((wp, index) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '4px';
        row.style.alignItems = 'center';

        ['x', 'y', 'z'].forEach((axis, i) => {
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'panel-input';
            input.style.width = '0';
            input.style.flex = '1';
            input.step = '0.5';
            input.placeholder = axis.toUpperCase();
            input.value = String(wp[i]);
            
            input.addEventListener('change', () => {
                const val = parseFloat(input.value);
                if (isNaN(val)) return;
                const newWp = [...wp] as [number, number, number];
                newWp[i] = val;
                const newWaypoints = [...waypoints];
                newWaypoints[index] = newWp;
                updateWaypoints(newWaypoints);
            });
            row.appendChild(input);
        });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'panel-button-small panel-button-danger';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove Waypoint';
        removeBtn.style.width = '24px';
        removeBtn.style.padding = '0';
        removeBtn.addEventListener('click', () => {
            const newWaypoints = waypoints.filter((_, i) => i !== index);
            updateWaypoints(newWaypoints);
        });
        row.appendChild(removeBtn);

        waypointsList.appendChild(row);
    });

    section.appendChild(waypointsList);

    // Buttons
    const buttonsRow = document.createElement('div');
    buttonsRow.style.display = 'flex';
    buttonsRow.style.gap = '8px';

    const addBtn = document.createElement('button');
    addBtn.className = 'panel-button';
    addBtn.textContent = '+ Add';
    addBtn.style.flex = '1';
    addBtn.addEventListener('click', () => {
        const lastWp = waypoints.length > 0 ? waypoints[waypoints.length - 1] : [0, 0, 0];
        const newWp = [lastWp[0] + 2, lastWp[1], lastWp[2]] as [number, number, number];
        updateWaypoints([...waypoints, newWp]);
    });
    buttonsRow.appendChild(addBtn);

    if (this.config.scene) {
        const captureBtn = document.createElement('button');
        captureBtn.className = 'panel-button';
        captureBtn.textContent = 'Capture Pos';
        captureBtn.style.flex = '1';
        captureBtn.title = 'Add current camera position as waypoint';
        captureBtn.addEventListener('click', () => {
            if (!this.config.scene) return;
            
            // Try to find camera
            const cameras = this.config.scene.queryEntities(CameraComponent);
            let pos: [number, number, number] = [0, 0, 0];
            
            if (cameras.length > 0) {
                const camPos = cameras[0].transform.position;
                pos = [
                    Math.round(camPos[0] * 10) / 10,
                    Math.round(camPos[1] * 10) / 10,
                    Math.round(camPos[2] * 10) / 10
                ];
            }
            
            updateWaypoints([...waypoints, pos]);
        });
        buttonsRow.appendChild(captureBtn);
    }

    section.appendChild(buttonsRow);

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

