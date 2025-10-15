import { createIcon, type IconName } from '../utils/icons';
import type { EditorState, WorkflowPreset } from '../core/state';
import { getAllWorkflowPresets, applyWorkflowPreset } from '../workflows/WorkflowPresets';

export interface WorkflowSelectorConfig {
  state: EditorState;
  onWorkflowChange?: (preset: WorkflowPreset) => void;
}

export class WorkflowSelector {
  private container: HTMLElement | null = null;
  private dropdown: HTMLElement | null = null;
  private isOpen = false;

  constructor(private readonly config: WorkflowSelectorConfig) {}

  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'workflow-selector';

    const button = this.createButton();
    container.appendChild(button);

    const dropdown = this.createDropdown();
    container.appendChild(dropdown);

    this.container = container;
    this.dropdown = dropdown;

    document.addEventListener('click', this.handleDocumentClick, true);

    return container;
  }

  refresh(): void {
    if (!this.container) return;

    const newButton = this.createButton();
    const existingButton = this.container.querySelector('.workflow-button');
    if (existingButton) {
      this.container.replaceChild(newButton, existingButton);
    }

    const newDropdown = this.createDropdown();
    if (this.isOpen) {
      newDropdown.hidden = false;
    }
    if (this.dropdown) {
      this.container.replaceChild(newDropdown, this.dropdown);
    } else {
      this.container.appendChild(newDropdown);
    }
    this.dropdown = newDropdown;
  }

  dispose(): void {
    document.removeEventListener('click', this.handleDocumentClick, true);
    this.container?.remove();
    this.container = null;
    this.dropdown = null;
  }

  private handleDocumentClick = (event: MouseEvent): void => {
    if (!this.container) return;
    if (!this.container.contains(event.target as Node)) {
      this.closeDropdown();
    }
  };

  private createButton(): HTMLElement {
    const currentPresetId = this.config.state.workflowPreset.value;
    const presets = getAllWorkflowPresets();
    const current = presets.find((preset) => preset.id === currentPresetId);
    const isCustom = !current;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'workflow-button';
    if (isCustom) {
      button.classList.add('workflow-button--custom');
    }
    button.title = isCustom 
      ? 'Custom workflow - Click to switch to a preset'
      : `${current.preset.name} - ${current.preset.description}`;

    const icon = createIcon((current?.preset.icon || 'settings') as IconName, 16);
    icon.classList.add('workflow-icon');

    const name = document.createElement('span');
    name.className = 'workflow-name';
    name.textContent = current?.preset.name ?? 'Custom';

    const arrow = createIcon('chevron-down', 12);
    arrow.classList.add('workflow-arrow');

    button.append(icon, name, arrow);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggleDropdown();
    });

    return button;
  }

  private createDropdown(): HTMLElement {
    const dropdown = document.createElement('div');
    dropdown.className = 'workflow-dropdown';
    dropdown.hidden = !this.isOpen;

    const presets = getAllWorkflowPresets();
    const currentPresetId = this.config.state.workflowPreset.value;

    // Header
    const header = document.createElement('div');
    header.className = 'workflow-dropdown-header';
    header.textContent = 'Workflow Presets';
    dropdown.appendChild(header);

    // Preset items
    for (const { id, preset } of presets) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'workflow-dropdown-item';

      if (id === currentPresetId) {
        item.classList.add('active');
        item.setAttribute('aria-current', 'true');
      }

      const icon = createIcon(preset.icon as IconName, 20);
      icon.classList.add('workflow-dropdown-icon');

      const content = document.createElement('div');
      content.className = 'workflow-dropdown-content';

      const name = document.createElement('div');
      name.className = 'workflow-dropdown-name';
      name.textContent = preset.name;

      const description = document.createElement('div');
      description.className = 'workflow-dropdown-description';
      description.textContent = preset.description;

      content.append(name, description);
      
      const checkmark = document.createElement('div');
      checkmark.className = 'workflow-dropdown-checkmark';
      if (id === currentPresetId) {
        checkmark.innerHTML = '✓';
      }

      item.append(icon, content, checkmark);

      item.addEventListener('click', () => {
        this.selectPreset(id);
      });

      dropdown.appendChild(item);
    }

    // Custom mode info
    if (currentPresetId === 'custom') {
      const customInfo = document.createElement('div');
      customInfo.className = 'workflow-dropdown-custom-info';
      customInfo.innerHTML = `
        <div class="workflow-dropdown-custom-info-icon">💡</div>
        <div class="workflow-dropdown-custom-info-text">
          You're using a custom configuration. Select a preset above to quickly switch your UI layout.
        </div>
      `;
      dropdown.appendChild(customInfo);
    }

    return dropdown;
  }

  private selectPreset(preset: Exclude<WorkflowPreset, 'custom'>): void {
    const updatedPreferences = applyWorkflowPreset(this.config.state.uiPreferences.value, preset);
    this.config.state.uiPreferences.value = updatedPreferences;
    this.config.state.workflowPreset.value = preset;

    this.config.onWorkflowChange?.(preset);

    this.closeDropdown();
    this.refresh();
  }

  private toggleDropdown(): void {
    this.isOpen = !this.isOpen;
    if (this.dropdown) {
      this.dropdown.hidden = !this.isOpen;
    }
    if (this.container) {
      this.container.classList.toggle('open', this.isOpen);
    }
  }

  private closeDropdown(): void {
    this.isOpen = false;
    if (this.dropdown) {
      this.dropdown.hidden = true;
    }
    if (this.container) {
      this.container.classList.remove('open');
    }
  }
}

