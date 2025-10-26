import { createIcon } from '../utils/icons';
import type { Entity } from '@engine/world';
import { ScriptComponent, type ScriptComponentState } from '@engine/world/components/ScriptComponent';
import { BehaviorRegistry } from '@engine/script';

interface ScriptWorkbenchConfig {
  onClose?: () => void;
  onScriptsApplied?: (entity: Entity, state: ScriptComponentState) => void;
  onRebuildRequested?: (entity: Entity, component: ScriptComponent) => void;
}

interface ValidationSummary {
  invalidNames: Set<number>;
  missingRegistry: Set<number>;
}

const DEBOUNCE_INPUT_MS = 180;
const DEBOUNCE_PARAMS_MS = 240;

export class ScriptWorkbench {
  private overlay: HTMLDivElement | null = null;
  private listContainer: HTMLDivElement | null = null;
  private detailContainer: HTMLElement | null = null;
  private statusLabel: HTMLSpanElement | null = null;
  private applyButton: HTMLButtonElement | null = null;
  private rebuildButton: HTMLButtonElement | null = null;
  private addButton: HTMLButtonElement | null = null;
  private entityLabel: HTMLSpanElement | null = null;
  private datalist: HTMLDataListElement | null = null;

  private entity: Entity | null = null;
  private state: ScriptComponentState = { scripts: [] };
  private selectedIndex = -1;
  private dirty = false;
  private invalidParams = new Set<number>();
  private validation: ValidationSummary = {
    invalidNames: new Set<number>(),
    missingRegistry: new Set<number>(),
  };

  private nameTimers = new WeakMap<HTMLInputElement, number>();
  private paramsTimers = new WeakMap<HTMLTextAreaElement, number>();
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private registryNames: string[] = [];

  constructor(private readonly config: ScriptWorkbenchConfig = {}) {}

  public isOpen(): boolean {
    return this.overlay !== null;
  }

  public open(entity: Entity): void {
    if (!entity) return;
    if (!this.overlay) {
      this.buildOverlay();
    }
    this.overlay!.classList.add('visible');
    document.body.classList.add('script-workbench-open');
    this.attachGlobalKeydown();

    this.entity = entity;
    this.syncFromEntity(entity);
    this.refreshRegistryNames();
    this.render();
  }

  public close(): void {
    if (!this.overlay) return;

    if (this.dirty && this.invalidParams.size === 0 && this.validation.invalidNames.size === 0) {
      this.applyChanges();
    }

    this.detachGlobalKeydown();
    document.body.classList.remove('script-workbench-open');
    this.overlay.classList.remove('visible');
    this.overlay.remove();

    this.overlay = null;
    this.listContainer = null;
    this.detailContainer = null;
    this.statusLabel = null;
    this.applyButton = null;
    this.rebuildButton = null;
    this.addButton = null;
    this.entityLabel = null;
    this.datalist = null;

    this.nameTimers = new WeakMap<HTMLInputElement, number>();
    this.paramsTimers = new WeakMap<HTMLTextAreaElement, number>();

    this.config.onClose?.();
  }

  public dispose(): void {
    this.close();
  }

  public updateEntity(entity: Entity | null): void {
    if (!this.isOpen()) return;
    if (!entity) {
      this.entity = null;
      this.state = { scripts: [] };
      this.selectedIndex = -1;
      this.render();
      return;
    }

    this.entity = entity;
    this.syncFromEntity(entity);
    this.render();
  }

  public isDirty(): boolean {
    return this.dirty;
  }

  private buildOverlay(): void {
    const overlay = document.createElement('div');
    overlay.className = 'script-workbench-overlay';

    const panel = document.createElement('div');
    panel.className = 'script-workbench-panel';

    const header = document.createElement('header');
    header.className = 'script-workbench-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'script-workbench-title-group';

    const title = document.createElement('h2');
    title.className = 'script-workbench-title';
    title.innerHTML = `${createIcon('list', 18).outerHTML} Script Workbench`;

    const entityLabel = document.createElement('span');
    entityLabel.className = 'script-workbench-entity';
    titleGroup.appendChild(title);
    titleGroup.appendChild(entityLabel);

    const actionGroup = document.createElement('div');
    actionGroup.className = 'script-workbench-header-actions';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'script-workbench-close';
    closeBtn.appendChild(createIcon('close', 16));
    closeBtn.appendChild(document.createTextNode('Close'));
    closeBtn.addEventListener('click', () => this.close());

    actionGroup.appendChild(closeBtn);

    header.appendChild(titleGroup);
    header.appendChild(actionGroup);

    const body = document.createElement('div');
    body.className = 'script-workbench-body';

    const sidebar = document.createElement('aside');
    sidebar.className = 'script-workbench-sidebar';

    const listHeader = document.createElement('div');
    listHeader.className = 'script-workbench-sidebar-header';
    listHeader.textContent = 'Scripts';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'script-workbench-add';
    addBtn.appendChild(createIcon('plus', 14));
    addBtn.appendChild(document.createTextNode('Add Script'));
    addBtn.addEventListener('click', () => this.handleAddScript());

    sidebar.appendChild(listHeader);
    sidebar.appendChild(addBtn);

    const listContainer = document.createElement('div');
    listContainer.className = 'script-workbench-list';
    sidebar.appendChild(listContainer);

    const detail = document.createElement('section');
    detail.className = 'script-workbench-detail';

    const footer = document.createElement('footer');
    footer.className = 'script-workbench-footer';

    const statusLabel = document.createElement('span');
    statusLabel.className = 'script-workbench-status';

    const footerActions = document.createElement('div');
    footerActions.className = 'script-workbench-footer-actions';

    const rebuildBtn = document.createElement('button');
    rebuildBtn.type = 'button';
    rebuildBtn.className = 'script-workbench-secondary';
    rebuildBtn.appendChild(createIcon('rotate-ccw', 14));
    rebuildBtn.appendChild(document.createTextNode('Rebuild Instances'));
    rebuildBtn.addEventListener('click', () => this.handleRebuild());

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'script-workbench-primary';
    applyBtn.appendChild(createIcon('check', 14));
    applyBtn.appendChild(document.createTextNode('Apply Changes'));
    applyBtn.addEventListener('click', () => this.applyChanges());

    footerActions.appendChild(rebuildBtn);
    footerActions.appendChild(applyBtn);

    footer.appendChild(statusLabel);
    footer.appendChild(footerActions);

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);

    body.appendChild(sidebar);
    body.appendChild(detail);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        this.close();
      }
    });

    const datalist = document.createElement('datalist');
    datalist.id = `behavior-registry-${Math.random().toString(36).slice(2)}`;
    panel.appendChild(datalist);

    this.overlay = overlay;
    this.listContainer = listContainer;
    this.detailContainer = detail;
    this.statusLabel = statusLabel;
    this.applyButton = applyBtn;
    this.rebuildButton = rebuildBtn;
    this.addButton = addBtn;
    this.entityLabel = entityLabel;
    this.datalist = datalist;
  }

  private attachGlobalKeydown(): void {
    if (this.keydownHandler) return;
    this.keydownHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        this.close();
      }
    };
    document.addEventListener('keydown', this.keydownHandler, { capture: true });
  }

  private detachGlobalKeydown(): void {
    if (!this.keydownHandler) return;
    document.removeEventListener('keydown', this.keydownHandler, { capture: true } as EventListenerOptions);
    this.keydownHandler = null;
  }

  private syncFromEntity(entity: Entity): void {
    const component = entity.getComponent(ScriptComponent);
    if (!component) {
      this.state = { scripts: [] };
      this.selectedIndex = -1;
      this.dirty = false;
      this.invalidParams.clear();
      this.validation.invalidNames.clear();
      this.validation.missingRegistry.clear();
      return;
    }

    const next = component.toJSON();
    this.state = {
      scripts: next.scripts.map((script) => ({
        name: script.name,
        ...(script.params ? { params: { ...script.params } } : {}),
        enabled: script.enabled ?? true,
      })),
    };
    this.selectedIndex = this.state.scripts.length > 0 ? Math.max(0, Math.min(this.selectedIndex, this.state.scripts.length - 1)) : -1;
    this.dirty = false;
    this.invalidParams.clear();
    this.validation.invalidNames.clear();
    this.validation.missingRegistry.clear();
    this.validateNames();
  }

  private render(): void {
    if (!this.overlay || !this.listContainer || !this.detailContainer) return;

    this.overlay.setAttribute('data-has-entity', this.entity ? 'true' : 'false');
    if (this.entityLabel) {
      this.entityLabel.textContent = this.entity ? `Entity: ${this.entity.name}` : 'No entity selected';
    }

    if (this.addButton) {
      this.addButton.disabled = !this.entity;
    }
    if (this.rebuildButton) {
      this.rebuildButton.disabled = !this.entity || !this.entity.getComponent(ScriptComponent);
    }

    this.renderList();
    this.renderDetail();
    this.updateApplyButtonState();
  }

  private renderList(): void {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';

    if (!this.entity) {
      const empty = document.createElement('div');
      empty.className = 'script-workbench-empty';
      empty.textContent = 'Select an entity with scripts to edit.';
      this.listContainer.appendChild(empty);
      return;
    }

    if (!this.state.scripts.length) {
      const empty = document.createElement('div');
      empty.className = 'script-workbench-empty';
      empty.textContent = 'No scripts attached. Add one to get started.';
      this.listContainer.appendChild(empty);
      return;
    }

    this.state.scripts.forEach((script, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'script-workbench-item';
      if (index === this.selectedIndex) {
        item.classList.add('active');
      }
      if (script.enabled === false) {
        item.classList.add('disabled');
      }
      if (this.validation.invalidNames.has(index)) {
        item.classList.add('invalid');
      } else if (this.validation.missingRegistry.has(index)) {
        item.classList.add('warning');
      }

      const name = document.createElement('span');
      name.className = 'script-workbench-item-name';
      const trimmed = (script.name ?? '').trim();
      name.textContent = trimmed || `Script ${index + 1}`;

      const meta = document.createElement('span');
      meta.className = 'script-workbench-item-meta';
      if (script.enabled === false) {
        meta.textContent = 'Disabled';
      } else if (this.validation.invalidNames.has(index)) {
        meta.textContent = 'Name required';
      } else if (this.validation.missingRegistry.has(index)) {
        meta.textContent = 'Not registered';
      } else {
        meta.textContent = 'Ready';
      }

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'script-workbench-item-toggle';
      toggle.title = script.enabled === false ? 'Enable script' : 'Disable script';
      toggle.appendChild(createIcon(script.enabled === false ? 'eye-off' : 'eye', 20));
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        this.toggleEnabled(index);
      });

      item.addEventListener('click', () => {
        this.selectedIndex = index;
        this.render();
      });

      item.appendChild(name);
      item.appendChild(meta);
      item.appendChild(toggle);
      this.listContainer!.appendChild(item);
    });
  }

  private renderDetail(): void {
    if (!this.detailContainer) return;
    this.detailContainer.innerHTML = '';

    if (!this.entity) {
      const empty = document.createElement('div');
      empty.className = 'script-workbench-detail-empty';
      empty.textContent = 'No entity selected. Choose an entity from the scene to edit scripts.';
      this.detailContainer.appendChild(empty);
      return;
    }

    if (this.state.scripts.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'script-workbench-detail-empty';
      empty.innerHTML = `${createIcon('info', 16).outerHTML} Add a script to configure its behavior.`;
      this.detailContainer.appendChild(empty);
      return;
    }

    if (this.selectedIndex < 0 || this.selectedIndex >= this.state.scripts.length) {
      this.selectedIndex = Math.min(this.state.scripts.length - 1, 0);
    }
    const script = this.state.scripts[this.selectedIndex]!;

    const header = document.createElement('div');
    header.className = 'script-workbench-detail-header';
    header.innerHTML = `${createIcon('edit', 18).outerHTML} Script Details`;

    const form = document.createElement('div');
    form.className = 'script-workbench-form';

    // Name field
    const nameGroup = document.createElement('label');
    nameGroup.className = 'script-workbench-field';

    const nameLabel = document.createElement('span');
    nameLabel.className = 'script-workbench-field-label';
    nameLabel.textContent = 'Behavior Name';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'script-workbench-input';
    nameInput.value = script.name ?? '';
    nameInput.placeholder = 'Enter registry behavior name';
    if (this.datalist) {
      nameInput.setAttribute('list', this.datalist.id);
    }

    nameInput.addEventListener('input', () => {
      window.clearTimeout(this.nameTimers.get(nameInput));
      const timer = window.setTimeout(() => {
        script.name = nameInput.value;
        this.markDirty();
        this.validateNames();
        this.renderList();
        this.updateApplyButtonState();
      }, DEBOUNCE_INPUT_MS);
      this.nameTimers.set(nameInput, timer);
    });

    nameInput.addEventListener('blur', () => {
      script.name = nameInput.value.trim();
      nameInput.value = script.name;
      this.markDirty();
      this.validateNames();
      this.renderList();
      this.updateApplyButtonState();
    });

    const nameHint = document.createElement('span');
    nameHint.className = 'script-workbench-hint';
    if (this.validation.invalidNames.has(this.selectedIndex)) {
      nameHint.textContent = 'Provide a behavior name registered via BehaviorRegistry.';
      nameHint.classList.add('error');
    } else if (this.validation.missingRegistry.has(this.selectedIndex)) {
      nameHint.textContent = 'Behavior not found in registry. Ensure it is registered at runtime.';
      nameHint.classList.add('warning');
    } else {
      nameHint.textContent = 'Matches registered behaviors automatically.';
    }

    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    nameGroup.appendChild(nameHint);

    // Enabled toggle
    const enabledGroup = document.createElement('div');
    enabledGroup.className = 'script-workbench-toggle-row';

    const enabledLabel = document.createElement('span');
    enabledLabel.textContent = 'Enabled';

    const enabledSwitch = document.createElement('label');
    enabledSwitch.className = 'toggle-switch';

    const enabledInput = document.createElement('input');
    enabledInput.type = 'checkbox';
    enabledInput.checked = script.enabled ?? true;
    enabledInput.addEventListener('change', () => {
      script.enabled = enabledInput.checked;
      this.markDirty();
      this.renderList();
    });

    const enabledSlider = document.createElement('span');
    enabledSlider.className = 'toggle-slider';

    enabledSwitch.appendChild(enabledInput);
    enabledSwitch.appendChild(enabledSlider);
    enabledGroup.appendChild(enabledLabel);
    enabledGroup.appendChild(enabledSwitch);

    // Params editor
    const paramsGroup = document.createElement('label');
    paramsGroup.className = 'script-workbench-field';

    const paramsLabel = document.createElement('span');
    paramsLabel.className = 'script-workbench-field-label';
    paramsLabel.textContent = 'Parameters (JSON)';

    const paramsEditor = document.createElement('textarea');
    paramsEditor.className = 'script-workbench-textarea';
    paramsEditor.rows = 10;
    paramsEditor.placeholder = '{ "speed": 2 }';
    paramsEditor.value = script.params ? JSON.stringify(script.params, null, 2) : '';

    const applyParams = () => {
      window.clearTimeout(this.paramsTimers.get(paramsEditor));
      const timer = window.setTimeout(() => {
        const text = paramsEditor.value.trim();
        if (!text) {
          delete (script as { params?: Record<string, unknown> }).params;
          paramsEditor.classList.remove('input-error');
          this.invalidParams.delete(this.selectedIndex);
          this.markDirty();
          this.updateApplyButtonState();
          return;
        }
        try {
          const parsed = JSON.parse(text) as Record<string, unknown>;
          script.params = parsed;
          paramsEditor.classList.remove('input-error');
          this.invalidParams.delete(this.selectedIndex);
          this.markDirty();
        } catch (err) {
          paramsEditor.classList.add('input-error');
          this.invalidParams.add(this.selectedIndex);
        }
        this.updateApplyButtonState();
      }, DEBOUNCE_PARAMS_MS);
      this.paramsTimers.set(paramsEditor, timer);
    };

    paramsEditor.addEventListener('input', applyParams);
    paramsEditor.addEventListener('blur', applyParams);

    const paramsHint = document.createElement('span');
    paramsHint.className = 'script-workbench-hint';
    paramsHint.textContent = 'Optional configuration serialized with the behavior.';
    if (this.invalidParams.has(this.selectedIndex)) {
      paramsHint.textContent = 'Invalid JSON. Fix syntax to apply changes.';
      paramsHint.classList.add('error');
    }

    paramsGroup.appendChild(paramsLabel);
    paramsGroup.appendChild(paramsEditor);
    paramsGroup.appendChild(paramsHint);

    // Actions: reorder / duplicate / delete
    const controls = document.createElement('div');
    controls.className = 'script-workbench-controls';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'script-workbench-control';
    upBtn.appendChild(createIcon('chevron-up', 14));
    upBtn.appendChild(document.createTextNode('Move Up'));
    upBtn.disabled = this.selectedIndex === 0;
    upBtn.addEventListener('click', () => this.moveScript(this.selectedIndex, this.selectedIndex - 1));

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'script-workbench-control';
    downBtn.appendChild(createIcon('chevron-down', 14));
    downBtn.appendChild(document.createTextNode('Move Down'));
    downBtn.disabled = this.selectedIndex === this.state.scripts.length - 1;
    downBtn.addEventListener('click', () => this.moveScript(this.selectedIndex, this.selectedIndex + 1));

    const duplicateBtn = document.createElement('button');
    duplicateBtn.type = 'button';
    duplicateBtn.className = 'script-workbench-control';
    duplicateBtn.appendChild(createIcon('copy', 14));
    duplicateBtn.appendChild(document.createTextNode('Duplicate'));
    duplicateBtn.addEventListener('click', () => this.duplicateScript(this.selectedIndex));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'script-workbench-danger';
    deleteBtn.appendChild(createIcon('trash', 14));
    deleteBtn.appendChild(document.createTextNode('Remove'));
    deleteBtn.addEventListener('click', () => this.removeScript(this.selectedIndex));

    controls.appendChild(upBtn);
    controls.appendChild(downBtn);
    controls.appendChild(duplicateBtn);
    controls.appendChild(deleteBtn);

    form.appendChild(nameGroup);
    form.appendChild(enabledGroup);
    form.appendChild(paramsGroup);
    form.appendChild(controls);

    this.detailContainer.appendChild(header);
    this.detailContainer.appendChild(form);
  }

  private refreshRegistryNames(): void {
    try {
      this.registryNames = BehaviorRegistry.list().slice().sort();
    } catch {
      this.registryNames = [];
    }
    if (!this.datalist) return;
    this.datalist.innerHTML = '';
    for (const name of this.registryNames) {
      const option = document.createElement('option');
      option.value = name;
      this.datalist.appendChild(option);
    }
  }

  private handleAddScript(): void {
    if (!this.entity) return;
    this.state.scripts.push({ name: '', params: {}, enabled: true });
    this.selectedIndex = this.state.scripts.length - 1;
    this.markDirty();
    this.validateNames();
    this.render();
  }

  private removeScript(index: number): void {
    if (index < 0 || index >= this.state.scripts.length) return;
    this.state.scripts.splice(index, 1);
    this.invalidParams.delete(index);
    this.resequenceValidationSets();
    this.selectedIndex = Math.min(this.state.scripts.length - 1, index);
    this.markDirty();
    this.render();
  }

  private duplicateScript(index: number): void {
    if (index < 0 || index >= this.state.scripts.length) return;
    const source = this.state.scripts[index]!;
    const clone = {
      name: source.name ? `${source.name}_Copy` : '',
      ...(source.params ? { params: { ...source.params } } : {}),
      enabled: source.enabled ?? true,
    };
    this.state.scripts.splice(index + 1, 0, clone);
    this.selectedIndex = index + 1;
    this.markDirty();
    this.validateNames();
    this.render();
  }

  private moveScript(from: number, to: number): void {
    if (from === to) return;
    if (from < 0 || from >= this.state.scripts.length) return;
    if (to < 0 || to >= this.state.scripts.length) return;
    const [removed] = this.state.scripts.splice(from, 1);
    if (!removed) return;
    this.state.scripts.splice(to, 0, removed);
    this.selectedIndex = to;
    this.markDirty();
    this.resequenceValidationSets();
    this.render();
  }

  private toggleEnabled(index: number): void {
    const script = this.state.scripts[index];
    if (!script) return;
    script.enabled = !(script.enabled ?? true);
    this.markDirty();
    this.renderList();
    this.updateApplyButtonState();
  }

  private handleRebuild(): void {
    if (!this.entity) return;
    const component = this.entity.getComponent(ScriptComponent);
    if (!component) return;
    try {
      component.rebuildInstances();
      this.config.onRebuildRequested?.(this.entity, component);
    } catch {
      // ignore rebuild errors
    }
  }

  private applyChanges(): void {
    if (!this.entity) return;
    const component = this.ensureComponent();
    if (!component) return;

    const filtered = this.state.scripts
      .map((script) => ({
        name: (script.name ?? '').trim(),
        ...(script.params ? { params: script.params } : {}),
        enabled: script.enabled ?? true,
      }))
      .filter((script) => script.name.length > 0);

    component.setScripts(filtered);
    this.state = component.toJSON();
    this.selectedIndex = this.state.scripts.length > 0 ? Math.min(this.selectedIndex, this.state.scripts.length - 1) : -1;
    this.dirty = false;
    this.invalidParams.clear();
    this.validateNames();
    this.render();
    this.config.onScriptsApplied?.(this.entity, this.state);
  }

  private ensureComponent(): ScriptComponent | null {
    if (!this.entity) return null;
    let component = this.entity.getComponent(ScriptComponent);
    if (!component) {
      try {
        component = new ScriptComponent();
        this.entity.addComponent(component);
      } catch {
        return null;
      }
    }
    return component;
  }

  private markDirty(): void {
    this.dirty = true;
  }

  private validateNames(): void {
    const invalid = new Set<number>();
    const missing = new Set<number>();
    this.state.scripts.forEach((script, index) => {
      const trimmed = (script.name ?? '').trim();
      if (!trimmed) {
        invalid.add(index);
        return;
      }
      if (!BehaviorRegistry.has(trimmed)) {
        missing.add(index);
      }
    });
    this.validation.invalidNames = invalid;
    this.validation.missingRegistry = missing;
  }

  private resequenceValidationSets(): void {
    const params = new Set<number>();
    this.invalidParams.forEach((index) => {
      if (index < this.state.scripts.length) {
        params.add(index);
      }
    });
    this.invalidParams = params;
    this.validateNames();
  }

  private updateApplyButtonState(): void {
    if (!this.applyButton || !this.statusLabel) return;
    const disable =
      !this.entity ||
      (this.state.scripts.length > 0 && this.validation.invalidNames.size > 0) ||
      this.invalidParams.size > 0;

    this.applyButton.disabled = disable;

    if (!this.entity) {
      this.statusLabel.textContent = 'Select an entity to apply changes.';
      this.statusLabel.className = 'script-workbench-status';
    } else if (this.validation.invalidNames.size > 0) {
      this.statusLabel.textContent = 'Fix missing behavior names before applying.';
      this.statusLabel.className = 'script-workbench-status error';
    } else if (this.invalidParams.size > 0) {
      this.statusLabel.textContent = 'Resolve JSON errors before applying.';
      this.statusLabel.className = 'script-workbench-status error';
    } else if (this.dirty) {
      this.statusLabel.textContent = 'Unsaved changes';
      this.statusLabel.className = 'script-workbench-status warning';
    } else {
      this.statusLabel.textContent = 'All changes applied';
      this.statusLabel.className = 'script-workbench-status success';
    }
  }
}


