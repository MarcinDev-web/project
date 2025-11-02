import { type TemplateMetadata } from '@engine/world-templates';
import { createIcon } from '../utils/icons';

export interface NewProjectConfig {
  name: string;
  description?: string;
  template?: TemplateMetadata | null;
  saveImmediately: boolean;
}

export interface NewProjectDialogResult {
  config: NewProjectConfig;
}

export interface NewProjectDialogOptions {
  defaultName?: string;
  defaultSaveImmediately?: boolean;
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

    const { defaultName = 'My Project', defaultSaveImmediately = false } = options;

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
        this.submit(nameInput.value.trim(), descInput.value.trim(), saveCheckbox.checked);
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

  private submit(name: string, description: string, saveImmediately: boolean): void {
    if (!name.trim()) {
      return;
    }

    const trimmedDescription = description.trim();
    const config: NewProjectConfig = {
      name: name.trim(),
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      template: this.templateSelected,
      saveImmediately,
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
