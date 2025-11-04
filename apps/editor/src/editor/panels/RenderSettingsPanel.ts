/**
 * Render Settings Panel
 * 
 * Provides UI controls for enabling/disabling rendering features:
 * - PBR/IBL (Physically Based Rendering with Image-Based Lighting)
 * - CSM Shadows (Cascaded Shadow Maps)
 * - Bloom post-processing
 * - FXAA anti-aliasing
 * - Forward+ lighting
 * - Screen-space LOD
 * - HDR rendering
 * - SSAO (Screen Space Ambient Occlusion)
 */

import type { EditorState } from '../core/state';
import { effect } from '@preact/signals-core';

export interface RenderSettingsPanelConfig {
  state: EditorState;
  onSettingsChanged?: (settings: RenderSettings) => void;
}

export interface RenderSettings {
  enableHDR: boolean;
  enableBloom: boolean;
  enableFXAA: boolean;
  enableSSAO: boolean;
  enableShadows: boolean;
  enableForwardPlus: boolean;
  enableScreenLOD: boolean;
  shadowQuality: 'low' | 'med' | 'high' | 'ultra';
}

export class RenderSettingsPanel {
  private container: HTMLElement | null = null;
  private state: EditorState;
  private onSettingsChanged?: (settings: RenderSettings) => void;
  private settings: RenderSettings;
  private cleanupEffects: (() => void)[] = [];

  constructor(config: RenderSettingsPanelConfig) {
    this.state = config.state;
    this.onSettingsChanged = config.onSettingsChanged;
    
    // Load saved settings from localStorage
    const saved = this.loadSettings();
    this.settings = {
      enableHDR: saved.enableHDR ?? true,
      enableBloom: saved.enableBloom ?? true,
      enableFXAA: saved.enableFXAA ?? false,
      enableSSAO: saved.enableSSAO ?? false,
      enableShadows: saved.enableShadows ?? true,
      enableForwardPlus: saved.enableForwardPlus ?? false,
      enableScreenLOD: saved.enableScreenLOD ?? false,
      shadowQuality: saved.shadowQuality ?? 'med',
    };

    // Persist settings when they change
    this.cleanupEffects.push(
      effect(() => {
        this.saveSettings(this.settings);
        this.onSettingsChanged?.(this.settings);
      })
    );
  }

  /**
   * Mounts the panel UI.
   */
  mount(parent: HTMLElement): void {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.className = 'render-settings-panel';
    parent.appendChild(this.container);

    this.updateUI();
  }

  /**
   * Updates the panel UI.
   */
  private updateUI(): void {
    if (!this.container) return;

    const html = `
      <div class="render-settings-header">
        <h3>🎨 Render Settings</h3>
        <p class="render-settings-subtitle">Control rendering features and quality</p>
      </div>

      <div class="render-settings-section">
        <div class="render-settings-label">Core Features</div>
        
        <label class="render-settings-toggle">
          <input type="checkbox" ${this.settings.enableHDR ? 'checked' : ''} data-setting="enableHDR">
          <span class="toggle-label">
            <span class="toggle-name">HDR Rendering</span>
            <span class="toggle-desc">High Dynamic Range (FP16) with proper tonemapping</span>
          </span>
        </label>

        <label class="render-settings-toggle">
          <input type="checkbox" ${this.settings.enableShadows ? 'checked' : ''} data-setting="enableShadows">
          <span class="toggle-label">
            <span class="toggle-name">Cascaded Shadow Maps</span>
            <span class="toggle-desc">PCSS soft shadows with 4 cascades</span>
          </span>
        </label>

        <label class="render-settings-toggle">
          <input type="checkbox" ${this.settings.enableBloom ? 'checked' : ''} data-setting="enableBloom">
          <span class="toggle-label">
            <span class="toggle-name">Bloom</span>
            <span class="toggle-desc">Glow effect for bright areas</span>
          </span>
        </label>

        <label class="render-settings-toggle">
          <input type="checkbox" ${this.settings.enableFXAA ? 'checked' : ''} data-setting="enableFXAA">
          <span class="toggle-label">
            <span class="toggle-name">FXAA</span>
            <span class="toggle-desc">Fast Approximate Anti-Aliasing</span>
          </span>
        </label>

        <label class="render-settings-toggle">
          <input type="checkbox" ${this.settings.enableSSAO ? 'checked' : ''} data-setting="enableSSAO">
          <span class="toggle-label">
            <span class="toggle-name">SSAO</span>
            <span class="toggle-desc">Screen Space Ambient Occlusion</span>
          </span>
        </label>
      </div>

      <div class="render-settings-section">
        <div class="render-settings-label">Advanced Features</div>
        
        <label class="render-settings-toggle">
          <input type="checkbox" ${this.settings.enableForwardPlus ? 'checked' : ''} data-setting="enableForwardPlus">
          <span class="toggle-label">
            <span class="toggle-name">Forward+ Lighting</span>
            <span class="toggle-desc">Tiled light culling for many lights</span>
          </span>
        </label>

        <label class="render-settings-toggle">
          <input type="checkbox" ${this.settings.enableScreenLOD ? 'checked' : ''} data-setting="enableScreenLOD">
          <span class="toggle-label">
            <span class="toggle-name">Screen-Space LOD</span>
            <span class="toggle-desc">GPU-based LOD selection with hysteresis</span>
          </span>
        </label>
      </div>

      <div class="render-settings-section">
        <div class="render-settings-label">Shadow Quality</div>
        <select class="render-settings-select" data-setting="shadowQuality">
          <option value="low" ${this.settings.shadowQuality === 'low' ? 'selected' : ''}>Low</option>
          <option value="med" ${this.settings.shadowQuality === 'med' ? 'selected' : ''}>Medium</option>
          <option value="high" ${this.settings.shadowQuality === 'high' ? 'selected' : ''}>High</option>
          <option value="ultra" ${this.settings.shadowQuality === 'ultra' ? 'selected' : ''}>Ultra</option>
        </select>
      </div>

      <div class="render-settings-info">
        <p>💡 Changes apply immediately. Press F3 to view performance stats.</p>
      </div>
    `;

    this.container.innerHTML = html;

    // Attach event listeners
    const checkboxes = this.container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const setting = target.dataset.setting as keyof RenderSettings;
        if (setting && typeof this.settings[setting] === 'boolean') {
          (this.settings[setting] as boolean) = target.checked;
          this.onSettingsChanged?.(this.settings);
          this.saveSettings(this.settings);
        }
      });
    });

    const selects = this.container.querySelectorAll('select');
    selects.forEach((select) => {
      select.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const setting = target.dataset.setting as keyof RenderSettings;
        if (setting) {
          (this.settings[setting] as string) = target.value;
          this.onSettingsChanged?.(this.settings);
          this.saveSettings(this.settings);
        }
      });
    });
  }

  /**
   * Gets current render settings.
   */
  getSettings(): Readonly<RenderSettings> {
    return { ...this.settings };
  }

  /**
   * Updates render settings.
   */
  updateSettings(settings: Partial<RenderSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.updateUI();
    this.saveSettings(this.settings);
    this.onSettingsChanged?.(this.settings);
  }

  /**
   * Loads settings from localStorage.
   */
  private loadSettings(): Partial<RenderSettings> {
    try {
      const saved = localStorage.getItem('renderSettings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return {};
  }

  /**
   * Saves settings to localStorage.
   */
  private saveSettings(settings: RenderSettings): void {
    try {
      localStorage.setItem('renderSettings', JSON.stringify(settings));
    } catch {
      // ignore
    }
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
    this.cleanupEffects.forEach((cleanup) => cleanup());
    this.cleanupEffects = [];
  }
}

