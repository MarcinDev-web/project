/**
 * EasyPlaceContextMenu - Right-click menu for Easy Place options.
 * 
 * Features:
 * - Toggle Easy Place mode
 * - Change pattern type
 * - Adjust spacing/radius settings
 * - Quick color/scale presets
 */

import type { EditorState, EasyPlacePattern } from '../core/state';
import { createIcon } from '../utils/icons';

export interface EasyPlaceContextMenuConfig {
  state: EditorState;
  onPatternChange?: (pattern: EasyPlacePattern) => void;
  onSettingChange?: (setting: string, value: number) => void;
}

/**
 * Context menu for Easy Place options
 */
export class EasyPlaceContextMenu {
  private menu: HTMLElement | null = null;
  private isVisible = false;

  constructor(private readonly config: EasyPlaceContextMenuConfig) {}

  /**
   * Shows the context menu at the specified position
   */
  show(x: number, y: number): void {
    if (this.menu) {
      this.hide();
    }

    this.menu = this.createMenu();
    this.positionMenu(x, y);
    document.body.appendChild(this.menu);
    this.isVisible = true;

    // Close on outside click
    const closeHandler = (e: MouseEvent) => {
      if (this.menu && !this.menu.contains(e.target as Node)) {
        this.hide();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
    }, 0);

    // Close on Escape
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  /**
   * Hides the context menu
   */
  hide(): void {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
      this.isVisible = false;
    }
  }

  /**
   * Creates the menu element
   */
  private createMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.className = 'easyplace-context-menu';

    // Easy Place toggle
    const toggleSection = this.createSection('Easy Place Mode');
    const toggleBtn = this.createToggleButton(
      'Enable Easy Place',
      this.config.state.easyPlaceMode.value,
      (enabled) => {
        this.config.state.easyPlaceMode.value = enabled;
        this.hide();
      }
    );
    toggleSection.appendChild(toggleBtn);
    menu.appendChild(toggleSection);

    // Pattern type section
    const patternSection = this.createSection('Pattern Type');
    const patterns: EasyPlacePattern[] = ['single', 'line', 'grid', 'circle'];
    patterns.forEach(pattern => {
      const btn = this.createMenuItem(
        this.getPatternIcon(pattern),
        this.getPatternLabel(pattern),
        () => {
          this.config.state.easyPlacePattern.value = pattern;
          this.config.onPatternChange?.(pattern);
          this.hide();
        }
      );
      if (this.config.state.easyPlacePattern.value === pattern) {
        btn.classList.add('active');
      }
      patternSection.appendChild(btn);
    });
    menu.appendChild(patternSection);

    // Settings section
    const settingsSection = this.createSection('Settings');
    const settings = this.config.state.easyPlaceSettings.value;

    // Grid spacing
    settingsSection.appendChild(
      this.createSliderControl('Grid Spacing', settings.gridSpacing, 0.5, 5, 0.25, (value) => {
        this.config.state.easyPlaceSettings.value = {
          ...this.config.state.easyPlaceSettings.value,
          gridSpacing: value,
        };
        this.config.onSettingChange?.('gridSpacing', value);
      })
    );

    // Line spacing
    settingsSection.appendChild(
      this.createSliderControl('Line Spacing', settings.lineSpacing, 0.5, 5, 0.25, (value) => {
        this.config.state.easyPlaceSettings.value = {
          ...this.config.state.easyPlaceSettings.value,
          lineSpacing: value,
        };
        this.config.onSettingChange?.('lineSpacing', value);
      })
    );

    // Circle radius
    settingsSection.appendChild(
      this.createSliderControl('Circle Radius', settings.circleRadius, 1, 10, 0.5, (value) => {
        this.config.state.easyPlaceSettings.value = {
          ...this.config.state.easyPlaceSettings.value,
          circleRadius: value,
        };
        this.config.onSettingChange?.('circleRadius', value);
      })
    );

    // Circle count
    settingsSection.appendChild(
      this.createSliderControl('Circle Count', settings.circleCount, 4, 20, 1, (value) => {
        this.config.state.easyPlaceSettings.value = {
          ...this.config.state.easyPlaceSettings.value,
          circleCount: Math.round(value),
        };
        this.config.onSettingChange?.('circleCount', Math.round(value));
      })
    );

    menu.appendChild(settingsSection);

    return menu;
  }

  /**
   * Creates a section with title
   */
  private createSection(title: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'easyplace-context-section';

    const titleEl = document.createElement('div');
    titleEl.className = 'easyplace-context-section-title';
    titleEl.textContent = title;
    section.appendChild(titleEl);

    return section;
  }

  /**
   * Creates a menu item
   */
  private createMenuItem(icon: string, label: string, onClick: () => void): HTMLElement {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'easyplace-context-item';

    const iconEl = createIcon(icon as any, 16);
    item.appendChild(iconEl);

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    item.appendChild(labelEl);

    item.addEventListener('click', onClick);

    return item;
  }

  /**
   * Creates a toggle button
   */
  private createToggleButton(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
    const container = document.createElement('div');
    container.className = 'easyplace-context-toggle';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.addEventListener('change', () => onChange(checkbox.checked));

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.prepend(checkbox);

    container.appendChild(labelEl);
    return container;
  }

  /**
   * Creates a slider control
   */
  private createSliderControl(
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void
  ): HTMLElement {
    const container = document.createElement('div');
    container.className = 'easyplace-context-slider';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    container.appendChild(labelEl);

    const controlRow = document.createElement('div');
    controlRow.className = 'easyplace-context-slider-row';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(value);

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'easyplace-context-slider-value';
    valueDisplay.textContent = value.toFixed(2);

    slider.addEventListener('input', () => {
      const newValue = parseFloat(slider.value);
      valueDisplay.textContent = newValue.toFixed(2);
      onChange(newValue);
    });

    controlRow.appendChild(slider);
    controlRow.appendChild(valueDisplay);
    container.appendChild(controlRow);

    return container;
  }

  /**
   * Positions the menu at the specified coordinates
   */
  private positionMenu(x: number, y: number): void {
    if (!this.menu) return;

    // Show menu first to get dimensions
    this.menu.style.left = `${x}px`;
    this.menu.style.top = `${y}px`;

    // Adjust if menu goes off screen
    const rect = this.menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      this.menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight) {
      this.menu.style.top = `${window.innerHeight - rect.height - 10}px`;
    }
  }

  /**
   * Gets icon for pattern type
   */
  private getPatternIcon(pattern: EasyPlacePattern): string {
    switch (pattern) {
      case 'single': return 'circle';
      case 'line': return 'line';
      case 'grid': return 'grid';
      case 'circle': return 'rotate';
      default: return 'circle';
    }
  }

  /**
   * Gets label for pattern type
   */
  private getPatternLabel(pattern: EasyPlacePattern): string {
    switch (pattern) {
      case 'single': return 'Single';
      case 'line': return 'Line Pattern';
      case 'grid': return 'Grid Pattern';
      case 'circle': return 'Circle Pattern';
      default: return 'Unknown';
    }
  }

  /**
   * Checks if menu is visible
   */
  isOpen(): boolean {
    return this.isVisible;
  }
}

