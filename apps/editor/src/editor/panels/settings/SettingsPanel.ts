/**
 * Settings Panel
 * 
 * Provides UI controls for editor preferences and configuration:
 * - UI Preferences (hotbar, inspector visibility)
 * - Precision Settings (movement/rotation steps)
 * - Camera Preferences (sensitivity, invert Y)
 * - Rotation Snap Mode
 * - History Limit
 * - Easy Place Settings
 */

import type { EditorState } from '../../core/state';
import type { UIPreferences, PrecisionSettings, CameraPreferences, RotationSnapMode, EasyPlaceSettings } from '../../core/state';
import { storageSave, storageLoad } from '../../../utils/storage';

export interface SettingsPanelConfig {
  state: EditorState;
  onSettingsChanged?: (settings: EditorSettings) => void;
}

export interface EditorSettings {
  uiPreferences: UIPreferences;
  precisionSettings: PrecisionSettings;
  cameraPreferences: CameraPreferences;
  rotationSnapMode: RotationSnapMode;
  historyLimit: number;
  easyPlaceSettings: EasyPlaceSettings;
}

export class SettingsPanel {
  private container: HTMLElement | null = null;
  private state: EditorState;
  private onSettingsChanged?: (settings: EditorSettings) => void;
  private settings: EditorSettings;

  constructor(config: SettingsPanelConfig) {
    const { state, onSettingsChanged } = config;
    this.state = state;
    if (onSettingsChanged) {
      this.onSettingsChanged = onSettingsChanged;
    }
    
    // Load saved settings from localStorage
    const saved = this.loadSettings();
    
    // Initialize settings from EditorState or saved values
    this.settings = {
      uiPreferences: {
        showHotbar: saved.uiPreferences?.showHotbar ?? this.state.uiPreferences.value.showHotbar,
        showInspector: saved.uiPreferences?.showInspector ?? this.state.uiPreferences.value.showInspector,
      },
      precisionSettings: {
        positionStep: saved.precisionSettings?.positionStep ?? this.state.precisionSettings.value.positionStep,
        fineStep: saved.precisionSettings?.fineStep ?? this.state.precisionSettings.value.fineStep,
        coarseStep: saved.precisionSettings?.coarseStep ?? this.state.precisionSettings.value.coarseStep,
        rotationStep: saved.precisionSettings?.rotationStep ?? this.state.precisionSettings.value.rotationStep,
        fineRotationStep: saved.precisionSettings?.fineRotationStep ?? this.state.precisionSettings.value.fineRotationStep,
      },
      cameraPreferences: {
        playModeCamera: saved.cameraPreferences?.playModeCamera ?? this.state.cameraPreferences.value.playModeCamera,
        thirdPersonDistance: saved.cameraPreferences?.thirdPersonDistance ?? this.state.cameraPreferences.value.thirdPersonDistance,
        thirdPersonHeight: saved.cameraPreferences?.thirdPersonHeight ?? this.state.cameraPreferences.value.thirdPersonHeight,
        sensitivity: saved.cameraPreferences?.sensitivity ?? this.state.cameraPreferences.value.sensitivity,
        invertY: saved.cameraPreferences?.invertY ?? this.state.cameraPreferences.value.invertY,
      },
      rotationSnapMode: saved.rotationSnapMode ?? this.state.rotationSnapMode.value,
      historyLimit: saved.historyLimit ?? this.state.historyLimit.value,
      easyPlaceSettings: {
        enabled: saved.easyPlaceSettings?.enabled ?? this.state.easyPlaceSettings.value.enabled,
        autoEnable: saved.easyPlaceSettings?.autoEnable ?? this.state.easyPlaceSettings.value.autoEnable,
        gridSpacing: saved.easyPlaceSettings?.gridSpacing ?? this.state.easyPlaceSettings.value.gridSpacing,
        lineSpacing: saved.easyPlaceSettings?.lineSpacing ?? this.state.easyPlaceSettings.value.lineSpacing,
        circleRadius: saved.easyPlaceSettings?.circleRadius ?? this.state.easyPlaceSettings.value.circleRadius,
        circleCount: saved.easyPlaceSettings?.circleCount ?? this.state.easyPlaceSettings.value.circleCount,
      },
    };

    // Apply settings to EditorState
    this.applySettings();
  }

  /**
   * Mounts the panel UI.
   */
  mount(parent: HTMLElement): void {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.className = 'settings-panel';
    parent.appendChild(this.container);

    this.updateUI();
  }

  /**
   * Updates the panel UI.
   */
  private updateUI(): void {
    if (!this.container) return;

    const html = `
      <div class="settings-header">
        <h3>⚙️ Editor Settings</h3>
        <p class="settings-subtitle">Configure editor preferences and behavior</p>
      </div>

      <div class="settings-section">
        <div class="settings-label">UI Preferences</div>
        
        <label class="settings-toggle">
          <input type="checkbox" ${this.settings.uiPreferences.showHotbar ? 'checked' : ''} data-setting="uiPreferences.showHotbar">
          <span class="toggle-label">
            <span class="toggle-name">Show Hotbar</span>
            <span class="toggle-desc">Display asset palette at bottom of screen</span>
          </span>
        </label>

        <label class="settings-toggle">
          <input type="checkbox" ${this.settings.uiPreferences.showInspector ? 'checked' : ''} data-setting="uiPreferences.showInspector">
          <span class="toggle-label">
            <span class="toggle-name">Show Inspector</span>
            <span class="toggle-desc">Display properties panel on the right</span>
          </span>
        </label>
      </div>

      <div class="settings-section">
        <div class="settings-label">Precision Controls</div>
        
        <div class="settings-input-group">
          <label class="settings-input-label">
            <span>Position Step</span>
            <span class="settings-input-desc">Arrow key movement distance</span>
          </label>
          <input type="number" class="settings-input" data-setting="precisionSettings.positionStep" 
                 value="${this.settings.precisionSettings.positionStep}" step="0.01" min="0.01" max="10">
        </div>

        <div class="settings-input-group">
          <label class="settings-input-label">
            <span>Fine Step</span>
            <span class="settings-input-desc">Shift+Arrow fine movement</span>
          </label>
          <input type="number" class="settings-input" data-setting="precisionSettings.fineStep" 
                 value="${this.settings.precisionSettings.fineStep}" step="0.01" min="0.001" max="1">
        </div>

        <div class="settings-input-group">
          <label class="settings-input-label">
            <span>Coarse Step</span>
            <span class="settings-input-desc">Ctrl+Arrow coarse movement</span>
          </label>
          <input type="number" class="settings-input" data-setting="precisionSettings.coarseStep" 
                 value="${this.settings.precisionSettings.coarseStep}" step="0.1" min="0.1" max="100">
        </div>

        <div class="settings-input-group">
          <label class="settings-input-label">
            <span>Rotation Step</span>
            <span class="settings-input-desc">Bracket key rotation (degrees)</span>
          </label>
          <input type="number" class="settings-input" data-setting="precisionSettings.rotationStep" 
                 value="${this.settings.precisionSettings.rotationStep}" step="1" min="1" max="90">
        </div>

        <div class="settings-input-group">
          <label class="settings-input-label">
            <span>Fine Rotation Step</span>
            <span class="settings-input-desc">Shift+Bracket fine rotation (degrees)</span>
          </label>
          <input type="number" class="settings-input" data-setting="precisionSettings.fineRotationStep" 
                 value="${this.settings.precisionSettings.fineRotationStep}" step="1" min="1" max="45">
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Camera Preferences</div>
        
        <div class="settings-input-group">
          <label class="settings-input-label">
            <span>Mouse Sensitivity</span>
            <span class="settings-input-desc">Camera rotation speed</span>
          </label>
          <input type="number" class="settings-input" data-setting="cameraPreferences.sensitivity" 
                 value="${this.settings.cameraPreferences.sensitivity}" step="0.0001" min="0.0001" max="0.01">
        </div>

        <label class="settings-toggle">
          <input type="checkbox" ${this.settings.cameraPreferences.invertY ? 'checked' : ''} data-setting="cameraPreferences.invertY">
          <span class="toggle-label">
            <span class="toggle-name">Invert Y Axis</span>
            <span class="toggle-desc">Invert vertical camera movement</span>
          </span>
        </label>

        <div class="settings-input-group">
          <label class="settings-input-label">
            <span>Third Person Distance</span>
            <span class="settings-input-desc">Camera distance in third person mode</span>
          </label>
          <input type="number" class="settings-input" data-setting="cameraPreferences.thirdPersonDistance" 
                 value="${this.settings.cameraPreferences.thirdPersonDistance}" step="0.1" min="1" max="20">
        </div>

        <div class="settings-input-group">
          <label class="settings-input-label">
            <span>Third Person Height</span>
            <span class="settings-input-desc">Camera height offset in third person mode</span>
          </label>
          <input type="number" class="settings-input" data-setting="cameraPreferences.thirdPersonHeight" 
                 value="${this.settings.cameraPreferences.thirdPersonHeight}" step="0.1" min="0" max="5">
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Rotation Snap</div>
        <select class="settings-select" data-setting="rotationSnapMode">
          <option value="free" ${this.settings.rotationSnapMode === 'free' ? 'selected' : ''}>Free</option>
          <option value="15deg" ${this.settings.rotationSnapMode === '15deg' ? 'selected' : ''}>15°</option>
          <option value="45deg" ${this.settings.rotationSnapMode === '45deg' ? 'selected' : ''}>45°</option>
          <option value="90deg" ${this.settings.rotationSnapMode === '90deg' ? 'selected' : ''}>90°</option>
        </select>
      </div>

      <div class="settings-section">
        <div class="settings-label">History</div>
        <div class="settings-input-group">
          <label class="settings-input-label">
            <span>History Limit</span>
            <span class="settings-input-desc">Maximum undo/redo steps</span>
          </label>
          <input type="number" class="settings-input" data-setting="historyLimit" 
                 value="${this.settings.historyLimit}" step="10" min="10" max="1000">
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Easy Place Mode</div>
        
        <label class="settings-toggle">
          <input type="checkbox" ${this.settings.easyPlaceSettings.enabled ? 'checked' : ''} data-setting="easyPlaceSettings.enabled">
          <span class="toggle-label">
            <span class="toggle-name">Enable Easy Place</span>
            <span class="toggle-desc">Automatically place blocks in patterns</span>
          </span>
        </label>

        <label class="settings-toggle">
          <input type="checkbox" ${this.settings.easyPlaceSettings.autoEnable ? 'checked' : ''} data-setting="easyPlaceSettings.autoEnable">
          <span class="toggle-label">
            <span class="toggle-name">Auto-Enable on Placement</span>
            <span class="toggle-desc">Automatically enable when entering placement mode</span>
          </span>
        </label>

        <div class="settings-input-group">
          <label class="settings-input-label">
            <span>Grid Spacing</span>
            <span class="settings-input-desc">Distance between grid placements</span>
          </label>
          <input type="number" class="settings-input" data-setting="easyPlaceSettings.gridSpacing" 
                 value="${this.settings.easyPlaceSettings.gridSpacing}" step="0.1" min="0.1" max="10">
        </div>

        <div class="settings-input-group">
          <label class="settings-input-label">
            <span>Line Spacing</span>
            <span class="settings-input-desc">Distance between line placements</span>
          </label>
          <input type="number" class="settings-input" data-setting="easyPlaceSettings.lineSpacing" 
                 value="${this.settings.easyPlaceSettings.lineSpacing}" step="0.1" min="0.1" max="10">
        </div>

        <div class="settings-input-group">
          <label class="settings-input-label">
            <span>Circle Radius</span>
            <span class="settings-input-desc">Radius for circle placement pattern</span>
          </label>
          <input type="number" class="settings-input" data-setting="easyPlaceSettings.circleRadius" 
                 value="${this.settings.easyPlaceSettings.circleRadius}" step="0.1" min="0.5" max="20">
        </div>

        <div class="settings-input-group">
          <label class="settings-input-label">
            <span>Circle Count</span>
            <span class="settings-input-desc">Number of blocks in circle pattern</span>
          </label>
          <input type="number" class="settings-input" data-setting="easyPlaceSettings.circleCount" 
                 value="${this.settings.easyPlaceSettings.circleCount}" step="1" min="3" max="64">
        </div>
      </div>

      <div class="settings-info">
        <p>💡 Changes are saved automatically and persist between sessions.</p>
      </div>
    `;

    this.container.innerHTML = html;

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Attaches event listeners to form controls.
   */
  private attachEventListeners(): void {
    if (!this.container) return;

    // Checkboxes
    const checkboxes = this.container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const settingPath = target.dataset.setting;
        if (settingPath) {
          this.updateNestedSetting(settingPath, target.checked);
        }
      });
    });

    // Number inputs
    const numberInputs = this.container.querySelectorAll('input[type="number"]');
    numberInputs.forEach((input) => {
      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const settingPath = target.dataset.setting;
        if (settingPath) {
          const value = parseFloat(target.value);
          if (!isNaN(value)) {
            this.updateNestedSetting(settingPath, value);
          }
        }
      });
    });

    // Selects
    const selects = this.container.querySelectorAll('select');
    selects.forEach((select) => {
      select.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const settingPath = target.dataset.setting;
        if (settingPath) {
          this.updateNestedSetting(settingPath, target.value);
        }
      });
    });
  }

  /**
   * Updates a nested setting by path (e.g., "uiPreferences.showHotbar").
   */
  private updateNestedSetting(path: string, value: unknown): void {
    const parts = path.split('.');
    let current: any = this.settings;
    
    // Navigate to the parent object
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
    }
    
    // Set the value
    const key = parts[parts.length - 1];
    if (key && current) {
      current[key] = value;
      this.applySettings();
      this.saveSettings();
      this.onSettingsChanged?.(this.getSettings());
    }
  }

  /**
   * Applies settings to EditorState.
   */
  private applySettings(): void {
    // Update UI preferences
    this.state.uiPreferences.value = { ...this.settings.uiPreferences };
    
    // Update precision settings
    this.state.precisionSettings.value = { ...this.settings.precisionSettings };
    
    // Update camera preferences
    this.state.cameraPreferences.value = { ...this.settings.cameraPreferences };
    
    // Update rotation snap mode
    this.state.rotationSnapMode.value = this.settings.rotationSnapMode;
    
    // Update history limit
    this.state.updateHistoryLimit(this.settings.historyLimit);
    
    // Update easy place settings
    this.state.easyPlaceSettings.value = { ...this.settings.easyPlaceSettings };
  }

  /**
   * Gets current editor settings.
   */
  getSettings(): Readonly<EditorSettings> {
    return {
      uiPreferences: { ...this.settings.uiPreferences },
      precisionSettings: { ...this.settings.precisionSettings },
      cameraPreferences: { ...this.settings.cameraPreferences },
      rotationSnapMode: this.settings.rotationSnapMode,
      historyLimit: this.settings.historyLimit,
      easyPlaceSettings: { ...this.settings.easyPlaceSettings },
    };
  }

  /**
   * Updates editor settings.
   */
  updateSettings(settings: Partial<EditorSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.applySettings();
    this.saveSettings();
    this.updateUI();
    this.onSettingsChanged?.(this.getSettings());
  }

  /**
   * Loads settings from localStorage.
   */
  private loadSettings(): Partial<EditorSettings> {
    return storageLoad<Partial<EditorSettings>>('editorSettings') ?? {};
  }

  /**
   * Saves settings to localStorage.
   */
  private saveSettings(): void {
    storageSave('editorSettings', this.settings);
  }

  /**
   * Gets the root element.
   */
  get element(): HTMLElement {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'settings-panel';
      this.updateUI();
    }
    return this.container;
  }

  /**
   * Unmounts the panel.
   */
  unmount(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  /**
   * Disposes of the panel.
   */
  dispose(): void {
    this.unmount();
  }
}

