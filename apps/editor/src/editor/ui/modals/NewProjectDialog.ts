import { type TemplateMetadata } from '@engine/world-templates';
import { createIcon } from '../../utils/icons';
import {
  createDefaultGameProjectConfig,
  type GameGenre,
  type GameVisibility,
} from '@shared/types/project';

export interface NewProjectConfig {
  name: string;
  description?: string;
  template?: TemplateMetadata | null;
  saveImmediately: boolean;
  configOverrides?: NewProjectConfigOverrides;
}

export interface NewProjectConfigOverrides {
  visibility?: GameVisibility;
  genre?: GameGenre;
  maxPlayers?: number;
  allowJoinInProgress?: boolean;
  respawnEnabled?: boolean;
  spawnPosition?: [number, number, number];
  spawnYaw?: number;
  cameraFov?: number;
}

export interface NewProjectDialogResult {
  config: NewProjectConfig;
}

export interface NewProjectDialogOptions {
  defaultName?: string;
  defaultSaveImmediately?: boolean;
  defaultDescription?: string;
}

export class NewProjectDialog {
  private overlay: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private resolver: ((result: NewProjectDialogResult | null) => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;
  private templateSelected: TemplateMetadata | null = null;

  public show(options: NewProjectDialogOptions = {}): Promise<NewProjectDialogResult | null> {
    if (this.modal) {
      return Promise.resolve(null);
    }

    const { defaultName = 'My Project', defaultSaveImmediately = false, defaultDescription } = options;
    const defaultConfig = createDefaultGameProjectConfig(defaultName, defaultDescription);
    const clampNumber = (value: number, min?: number, max?: number): number => {
      let v = value;
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      return v;
    };
    const parseNumber = (value: string, fallback: number, min?: number, max?: number): number => {
      const num = Number(value);
      if (!Number.isFinite(num)) return fallback;
      return clampNumber(num, min, max);
    };
    const parseInteger = (value: string, fallback: number, min?: number, max?: number): number => {
      const num = Number.parseInt(value, 10);
      if (!Number.isFinite(num)) return fallback;
      return clampNumber(num, min, max);
    };

    return new Promise<NewProjectDialogResult | null>((resolve) => {
      this.resolver = resolve;
      this.overlay = document.createElement('div');
      this.overlay.className = 'modal-overlay new-project-dialog-overlay';

      this.modal = document.createElement('div');
      this.modal.className = 'modal new-project-dialog';

      // Header
      const header = document.createElement('div');
      header.className = 'new-project-dialog-header';

      const heading = document.createElement('h2');
      heading.className = 'new-project-dialog-title';
      heading.textContent = 'Create New Project';

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'btn btn-icon new-project-dialog-close';
      closeBtn.appendChild(createIcon('close', 18));
      closeBtn.addEventListener('click', () => this.close(null));

      header.appendChild(heading);
      header.appendChild(closeBtn);
      this.modal.appendChild(header);

      // Form content
      const form = document.createElement('form');
      form.className = 'new-project-dialog-form';
      const formId = `new-project-form-${Date.now()}`;
      form.id = formId;

      // Project name
      const nameGroup = document.createElement('div');
      nameGroup.className = 'form-group';
      const nameLabel = document.createElement('label');
      nameLabel.textContent = 'Project Name';
      nameLabel.className = 'form-label';
      nameLabel.setAttribute('for', 'project-name');
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.id = 'project-name';
      nameInput.className = 'form-input';
      nameInput.value = defaultName;
      nameInput.required = true;
      nameInput.placeholder = 'Enter project name';
      nameInput.autofocus = true;
      nameGroup.appendChild(nameLabel);
      nameGroup.appendChild(nameInput);
      form.appendChild(nameGroup);

      // Project description (optional)
      const descGroup = document.createElement('div');
      descGroup.className = 'form-group';
      const descLabel = document.createElement('label');
      descLabel.textContent = 'Description (optional)';
      descLabel.className = 'form-label';
      descLabel.setAttribute('for', 'project-description');
      const descInput = document.createElement('textarea');
      descInput.id = 'project-description';
      descInput.className = 'form-textarea';
      descInput.placeholder = 'Brief description of your project...';
      descInput.rows = 2;
      if (defaultDescription) {
        descInput.value = defaultDescription;
      }
      descGroup.appendChild(descLabel);
      descGroup.appendChild(descInput);
      form.appendChild(descGroup);

      // Template selection section
      const templateSection = document.createElement('div');
      templateSection.className = 'new-project-dialog-template-section';

      const templateLabel = document.createElement('label');
      templateLabel.textContent = 'Start with Template (optional)';
      templateLabel.className = 'form-label';
      templateSection.appendChild(templateLabel);

      const templateContainer = document.createElement('div');
      templateContainer.className = 'new-project-dialog-template-container';

      const selectedTemplateDisplay = document.createElement('div');
      selectedTemplateDisplay.className = 'new-project-dialog-template-display';
      selectedTemplateDisplay.style.display = 'none';
      templateContainer.appendChild(selectedTemplateDisplay);

      const templateButtons = document.createElement('div');
      templateButtons.className = 'new-project-dialog-template-buttons';

      const selectTemplateBtn = document.createElement('button');
      selectTemplateBtn.type = 'button';
      selectTemplateBtn.className = 'btn btn-secondary';
      selectTemplateBtn.textContent = this.templateSelected ? 'Change Template' : 'Select Template';
      selectTemplateBtn.addEventListener('click', () => {
        this.showTemplatePicker((template) => {
          this.templateSelected = template;
          selectTemplateBtn.textContent = 'Change Template';
          this.updateTemplateDisplay(selectedTemplateDisplay, template);
        });
      });

      const clearTemplateBtn = document.createElement('button');
      clearTemplateBtn.type = 'button';
      clearTemplateBtn.className = 'btn btn-secondary';
      clearTemplateBtn.textContent = 'No Template';
      clearTemplateBtn.style.display = this.templateSelected ? 'inline-block' : 'none';
      clearTemplateBtn.addEventListener('click', () => {
        this.templateSelected = null;
        selectTemplateBtn.textContent = 'Select Template';
        selectedTemplateDisplay.style.display = 'none';
        clearTemplateBtn.style.display = 'none';
      });

      templateButtons.appendChild(selectTemplateBtn);
      templateButtons.appendChild(clearTemplateBtn);
      templateContainer.appendChild(templateButtons);

      templateSection.appendChild(templateContainer);
      form.appendChild(templateSection);

      // Gameplay configuration
      const configSection = document.createElement('div');
      configSection.className = 'new-project-config-section';
      Object.assign(configSection.style, {
        marginTop: '1rem',
        padding: '1rem',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        background: 'rgba(255, 255, 255, 0.03)',
      });

      const configHeading = document.createElement('h3');
      configHeading.className = 'new-project-config-title';
      configHeading.textContent = 'Game Configuration';
      Object.assign(configHeading.style, {
        margin: '0 0 0.75rem 0',
        fontSize: '1rem',
        fontWeight: '600',
      });
      configSection.appendChild(configHeading);

      const configGrid = document.createElement('div');
      configGrid.className = 'new-project-config-grid';
      Object.assign(configGrid.style, {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.75rem',
      });

      // Visibility
      const visibilityGroup = document.createElement('div');
      visibilityGroup.className = 'form-group';
      const visibilityLabel = document.createElement('label');
      visibilityLabel.textContent = 'Visibility';
      visibilityLabel.className = 'form-label';
      const visibilitySelect = document.createElement('select');
      visibilitySelect.className = 'form-select';
      const visOptions: GameVisibility[] = ['private', 'unlisted', 'public'];
      for (const option of visOptions) {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option.charAt(0).toUpperCase() + option.slice(1);
        if (option === defaultConfig.info.visibility) opt.selected = true;
        visibilitySelect.appendChild(opt);
      }
      visibilityGroup.appendChild(visibilityLabel);
      visibilityGroup.appendChild(visibilitySelect);
      configGrid.appendChild(visibilityGroup);

      // Genre
      const genreGroup = document.createElement('div');
      genreGroup.className = 'form-group';
      const genreLabel = document.createElement('label');
      genreLabel.textContent = 'Genre';
      genreLabel.className = 'form-label';
      const genreSelect = document.createElement('select');
      genreSelect.className = 'form-select';
      const genreOptions: GameGenre[] = ['sandbox', 'pvp', 'co-op', 'adventure'];
      for (const option of genreOptions) {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option.toUpperCase();
        if (option === defaultConfig.info.genre) opt.selected = true;
        genreSelect.appendChild(opt);
      }
      genreGroup.appendChild(genreLabel);
      genreGroup.appendChild(genreSelect);
      configGrid.appendChild(genreGroup);

      // Max players
      const maxPlayersGroup = document.createElement('div');
      maxPlayersGroup.className = 'form-group';
      const maxPlayersLabel = document.createElement('label');
      maxPlayersLabel.textContent = 'Max players';
      maxPlayersLabel.className = 'form-label';
      const maxPlayersInput = document.createElement('input');
      maxPlayersInput.type = 'number';
      maxPlayersInput.min = '1';
      maxPlayersInput.max = '64';
      maxPlayersInput.value = String(defaultConfig.gameplay.maxPlayers);
      maxPlayersInput.className = 'form-input';
      maxPlayersGroup.appendChild(maxPlayersLabel);
      maxPlayersGroup.appendChild(maxPlayersInput);
      configGrid.appendChild(maxPlayersGroup);

      // Allow join in progress
      const joinGroup = document.createElement('div');
      joinGroup.className = 'form-group form-group-checkbox';
      const joinCheckbox = document.createElement('input');
      joinCheckbox.type = 'checkbox';
      joinCheckbox.id = 'allow-join-progress';
      joinCheckbox.className = 'form-checkbox';
      joinCheckbox.checked = defaultConfig.gameplay.allowJoinInProgress;
      const joinLabel = document.createElement('label');
      joinLabel.setAttribute('for', 'allow-join-progress');
      joinLabel.className = 'form-label form-label-checkbox';
      joinLabel.textContent = 'Allow join in progress';
      joinGroup.appendChild(joinCheckbox);
      joinGroup.appendChild(joinLabel);
      configGrid.appendChild(joinGroup);

      // Respawn toggle
      const respawnGroup = document.createElement('div');
      respawnGroup.className = 'form-group form-group-checkbox';
      const respawnCheckbox = document.createElement('input');
      respawnCheckbox.type = 'checkbox';
      respawnCheckbox.id = 'respawn-enabled';
      respawnCheckbox.className = 'form-checkbox';
      respawnCheckbox.checked = defaultConfig.gameplay.respawnEnabled;
      const respawnLabel = document.createElement('label');
      respawnLabel.setAttribute('for', 'respawn-enabled');
      respawnLabel.className = 'form-label form-label-checkbox';
      respawnLabel.textContent = 'Enable respawn';
      respawnGroup.appendChild(respawnCheckbox);
      respawnGroup.appendChild(respawnLabel);
      configGrid.appendChild(respawnGroup);

      // Camera FOV
      const fovGroup = document.createElement('div');
      fovGroup.className = 'form-group';
      const fovLabel = document.createElement('label');
      fovLabel.textContent = 'Camera FOV';
      fovLabel.className = 'form-label';
      const fovInput = document.createElement('input');
      fovInput.type = 'number';
      fovInput.min = '40';
      fovInput.max = '120';
      fovInput.step = '1';
      fovInput.value = String(defaultConfig.camera.fov);
      fovInput.className = 'form-input';
      fovGroup.appendChild(fovLabel);
      fovGroup.appendChild(fovInput);
      configGrid.appendChild(fovGroup);

      // Spawn position
      const spawnGroup = document.createElement('div');
      spawnGroup.className = 'form-group';
      const spawnLabel = document.createElement('label');
      spawnLabel.textContent = 'Spawn position (X, Y, Z)';
      spawnLabel.className = 'form-label';
      const spawnInputsWrapper = document.createElement('div');
      spawnInputsWrapper.className = 'spawn-inputs';
      Object.assign(spawnInputsWrapper.style, {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '0.5rem',
      });
      const [x, y, z] = defaultConfig.world.spawn.position;
      const spawnXInput = document.createElement('input');
      spawnXInput.type = 'number';
      spawnXInput.step = '0.1';
      spawnXInput.value = String(x);
      spawnXInput.className = 'form-input';
      const spawnYInput = document.createElement('input');
      spawnYInput.type = 'number';
      spawnYInput.step = '0.1';
      spawnYInput.value = String(y);
      spawnYInput.className = 'form-input';
      const spawnZInput = document.createElement('input');
      spawnZInput.type = 'number';
      spawnZInput.step = '0.1';
      spawnZInput.value = String(z);
      spawnZInput.className = 'form-input';
      spawnInputsWrapper.appendChild(spawnXInput);
      spawnInputsWrapper.appendChild(spawnYInput);
      spawnInputsWrapper.appendChild(spawnZInput);
      spawnGroup.appendChild(spawnLabel);
      spawnGroup.appendChild(spawnInputsWrapper);
      configGrid.appendChild(spawnGroup);

      // Spawn yaw
      const yawGroup = document.createElement('div');
      yawGroup.className = 'form-group';
      const yawLabel = document.createElement('label');
      yawLabel.textContent = 'Spawn yaw (deg)';
      yawLabel.className = 'form-label';
      const yawInput = document.createElement('input');
      yawInput.type = 'number';
      yawInput.step = '1';
      yawInput.value = '0';
      yawInput.className = 'form-input';
      yawGroup.appendChild(yawLabel);
      yawGroup.appendChild(yawInput);
      configGrid.appendChild(yawGroup);

      configSection.appendChild(configGrid);
      form.appendChild(configSection);

      // Save immediately option
      const saveGroup = document.createElement('div');
      saveGroup.className = 'form-group form-group-checkbox';
      const saveCheckboxWrapper = document.createElement('div');
      saveCheckboxWrapper.style.position = 'relative';
      saveCheckboxWrapper.style.display = 'flex';
      const saveCheckbox = document.createElement('input');
      saveCheckbox.type = 'checkbox';
      saveCheckbox.id = 'save-immediately';
      saveCheckbox.className = 'form-checkbox';
      saveCheckbox.checked = defaultSaveImmediately;
      const saveLabel = document.createElement('label');
      saveLabel.className = 'form-label form-label-checkbox';
      saveLabel.setAttribute('for', 'save-immediately');
      saveLabel.textContent = 'Save project immediately after creation';
      saveCheckboxWrapper.appendChild(saveCheckbox);
      saveGroup.appendChild(saveCheckboxWrapper);
      saveGroup.appendChild(saveLabel);
      form.appendChild(saveGroup);

      this.modal.appendChild(form);

      // Footer with actions
      const footer = document.createElement('div');
      footer.className = 'new-project-dialog-footer';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => this.close(null));

      const createBtn = document.createElement('button');
      createBtn.type = 'submit';
      createBtn.className = 'btn btn-primary';
      createBtn.textContent = 'Create Project';
      createBtn.setAttribute('form', formId);
      
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submit(
          nameInput.value.trim(),
          descInput.value.trim(),
          saveCheckbox.checked,
          {
            visibility: visibilitySelect.value as GameVisibility,
            genre: genreSelect.value as GameGenre,
            maxPlayers: parseInteger(maxPlayersInput.value, defaultConfig.gameplay.maxPlayers, 1, 64),
            allowJoinInProgress: joinCheckbox.checked,
            respawnEnabled: respawnCheckbox.checked,
            spawnPosition: [
              parseNumber(spawnXInput.value, defaultConfig.world.spawn.position[0]),
              parseNumber(spawnYInput.value, defaultConfig.world.spawn.position[1]),
              parseNumber(spawnZInput.value, defaultConfig.world.spawn.position[2]),
            ],
            spawnYaw: parseNumber(yawInput.value, 0),
            cameraFov: parseNumber(fovInput.value, defaultConfig.camera.fov, 40, 120),
          }
        );
      });

      footer.appendChild(cancelBtn);
      footer.appendChild(createBtn);
      this.modal.appendChild(footer);

      this.overlay.addEventListener('click', (event) => {
        if (event.target === this.overlay) {
          this.close(null);
        }
      });

      this.keyHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          this.close(null);
        }
      };
      window.addEventListener('keydown', this.keyHandler);

      document.body.appendChild(this.overlay);
      this.overlay.appendChild(this.modal);

      // Focus name input
      requestAnimationFrame(() => {
        nameInput.focus();
        nameInput.select();
      });
    });
  }

  private updateTemplateDisplay(container: HTMLElement, template: TemplateMetadata): void {
    container.style.display = 'block';
    container.innerHTML = '';

    const templateInfo = document.createElement('div');
    templateInfo.className = 'new-project-dialog-template-info';

    const name = document.createElement('div');
    name.className = 'new-project-dialog-template-name';
    name.textContent = template.name;
    templateInfo.appendChild(name);

    if (template.description) {
      const desc = document.createElement('div');
      desc.className = 'new-project-dialog-template-desc';
      desc.textContent = template.description;
      templateInfo.appendChild(desc);
    }

    const badge = document.createElement('span');
    badge.className = 'new-project-dialog-template-badge';
    badge.textContent = template.kind === 'seed' ? 'Seed' : 'Template';
    templateInfo.appendChild(badge);

    container.appendChild(templateInfo);
  }

  private async showTemplatePicker(
    onSelect: (template: TemplateMetadata) => void
  ): Promise<void> {
    // Close this dialog temporarily
    const currentModal = this.modal;
    const currentOverlay = this.overlay;
    if (currentModal && currentOverlay) {
      document.body.removeChild(currentOverlay);
    }

    // Create temporary template picker
    const { TemplatePickerModal } = await import('./TemplatePickerModal');
    const picker = new TemplatePickerModal();
    const result = await picker.pickTemplate({
      title: 'Select Template',
      subtitle: 'Choose a template to start your project.',
      confirmLabel: 'Use This Template',
      includeSeeds: true,
    });

    // Restore this dialog
    if (currentModal && currentOverlay) {
      document.body.appendChild(currentOverlay);
    }

    if (result) {
      onSelect(result.template);
    }
  }

  private submit(
    name: string,
    description: string,
    saveImmediately: boolean,
    overrides: NewProjectConfigOverrides
  ): void {
    if (!name.trim()) {
      return;
    }

    const trimmedDescription = description.trim();
    const config: NewProjectConfig = {
      name: name.trim(),
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      template: this.templateSelected,
      saveImmediately,
      configOverrides: overrides,
    };

    this.close({ config });
  }

  private close(result: NewProjectDialogResult | null): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    if (this.modal) {
      this.modal = null;
    }

    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }

    const resolve = this.resolver;
    this.resolver = null;
    this.templateSelected = null;
    resolve?.(result);
  }
}
