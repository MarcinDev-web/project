/**
 * LogicPanel - Panel for editing logic cube configuration
 */

import type { Entity } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import { LogicCubeComponent } from '@engine/world/components/LogicCubeComponent';
import { LogicCubeLibrary } from '../managers/LogicCubeLibrary';
import type { LogicCubeCategory, LogicConnection } from '@engine/script/cubes/types';
import { getLogicConnectionManager } from '@engine/script';

export interface LogicPanelConfig {
  selection: SelectionManager;
  onConfigChanged?: () => void;
}

/**
 * Panel for configuring logic cubes
 */
export class LogicPanel {
  private container: HTMLElement;
  private selection: SelectionManager;
  private onConfigChanged: () => void;
  private currentEntity: Entity | null = null;

  constructor(config: LogicPanelConfig) {
    this.selection = config.selection;
    this.onConfigChanged = config.onConfigChanged ?? (() => {});
    this.container = this.createContainer();

    // Listen to selection changes
    this.selection.onSelectionChanged(() => {
      this.refresh();
    });
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'logic-panel';
    return container;
  }

  /**
   * Gets the panel element
   */
  get element(): HTMLElement {
    return this.container;
  }

  /**
   * Refreshes the panel content
   */
  refresh(): void {
    const entity = this.selection.primarySelection;
    this.currentEntity = entity;

    // Clear container
    this.container.innerHTML = '';

    if (!entity) {
      this.showNoSelection();
      return;
    }

    const component = entity.getComponent(LogicCubeComponent);
    if (!component) {
      this.showNotLogicCube();
      return;
    }

    this.renderLogicCubeEditor(entity, component);
  }

  private showNoSelection(): void {
    const message = document.createElement('div');
    message.className = 'logic-panel__empty';
    message.textContent = 'Select a logic cube to edit';
    this.container.appendChild(message);
  }

  private showNotLogicCube(): void {
    const message = document.createElement('div');
    message.className = 'logic-panel__empty';
    message.innerHTML = `
      <p>Selected entity is not a logic cube.</p>
      <button class="logic-panel__convert-btn">Convert to Logic Cube</button>
    `;

    const btn = message.querySelector('.logic-panel__convert-btn') as HTMLButtonElement;
    if (btn) {
      btn.addEventListener('click', () => {
        this.convertToLogicCube();
      });
    }

    this.container.appendChild(message);
  }

  private convertToLogicCube(): void {
    if (!this.currentEntity) return;

    const component = new LogicCubeComponent();
    component.setCubeType('onClickTrigger'); // Default type
    this.currentEntity.addComponent(component);

    this.refresh();
    this.onConfigChanged();
  }

  private renderLogicCubeEditor(entity: Entity, component: LogicCubeComponent): void {
    // Header
    const header = document.createElement('div');
    header.className = 'logic-panel__header';
    header.innerHTML = `
      <h3>Logic Cube</h3>
      <div class="logic-panel__enabled">
        <label>
          <input type="checkbox" ${component.isEnabled() ? 'checked' : ''} />
          <span>Enabled</span>
        </label>
      </div>
    `;

    const checkbox = header.querySelector('input[type="checkbox"]') as HTMLInputElement;
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        component.setEnabled(checkbox.checked);
        this.onConfigChanged();
      });
    }

    this.container.appendChild(header);

    // Cube Type Selector
    const typeSection = this.createTypeSelector(component);
    this.container.appendChild(typeSection);

    // Configuration Parameters
    const configSection = this.createConfigSection(component);
    this.container.appendChild(configSection);

    // Connections Section
    const connectionsSection = this.createConnectionsSection(entity);
    this.container.appendChild(connectionsSection);
  }

  private createTypeSelector(component: LogicCubeComponent): HTMLElement {
    const section = document.createElement('div');
    section.className = 'logic-panel__section';

    const label = document.createElement('label');
    label.className = 'logic-panel__label';
    label.textContent = 'Cube Type';

    const select = document.createElement('select');
    select.className = 'logic-panel__select';

    // Group by category
    const categories: LogicCubeCategory[] = LogicCubeLibrary.getCategories();
    for (const category of categories) {
      const group = document.createElement('optgroup');
      group.label = category.charAt(0).toUpperCase() + category.slice(1);

      const cubes = LogicCubeLibrary.getByCategory(category);
      for (const entry of cubes) {
        const option = document.createElement('option');
        option.value = entry.metadata.type;
        option.textContent = entry.metadata.displayName;
        option.selected = entry.metadata.type === component.getCubeType();
        group.appendChild(option);
      }

      select.appendChild(group);
    }

    select.addEventListener('change', () => {
      component.setCubeType(select.value);
      component.setConfig({}); // Reset config
      this.refresh();
      this.onConfigChanged();
    });

    section.appendChild(label);
    section.appendChild(select);

    return section;
  }

  private createConfigSection(component: LogicCubeComponent): HTMLElement {
    const section = document.createElement('div');
    section.className = 'logic-panel__section';

    const heading = document.createElement('h4');
    heading.textContent = 'Configuration';
    section.appendChild(heading);

    // Get metadata for current cube type
    const cubeType = component.getCubeType();
    const entry = LogicCubeLibrary.get(cubeType);

    if (!entry) {
      const message = document.createElement('p');
      message.textContent = 'No configuration available';
      section.appendChild(message);
      return section;
    }

    const metadata = entry.metadata;
    if (metadata.parameters.length === 0) {
      const message = document.createElement('p');
      message.textContent = 'No parameters to configure';
      section.appendChild(message);
      return section;
    }

    // Create form for each parameter
    for (const param of metadata.parameters) {
      const field = this.createParameterField(component, param);
      section.appendChild(field);
    }

    return section;
  }

  private createParameterField(
    component: LogicCubeComponent,
    param: { key: string; label: string; type: string; defaultValue: unknown; min?: number; max?: number; options?: Array<{ label: string; value: unknown }> }
  ): HTMLElement {
    const field = document.createElement('div');
    field.className = 'logic-panel__field';

    const label = document.createElement('label');
    label.className = 'logic-panel__label';
    label.textContent = param.label;
    field.appendChild(label);

    const value = component.getConfigValue(param.key, param.defaultValue);

    let input: HTMLInputElement | HTMLSelectElement;

    if (param.type === 'select' && param.options) {
      const selectEl = document.createElement('select');
      selectEl.className = 'logic-panel__input';

      for (const option of param.options) {
        const opt = document.createElement('option');
        opt.value = String(option.value);
        opt.textContent = option.label;
        opt.selected = String(option.value) === String(value);
        selectEl.appendChild(opt);
      }

      selectEl.addEventListener('change', () => {
        component.setConfigValue(param.key, selectEl.value);
        this.onConfigChanged();
      });

      input = selectEl;
    } else if (param.type === 'boolean') {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'logic-panel__checkbox';
      checkbox.checked = Boolean(value);

      checkbox.addEventListener('change', () => {
        component.setConfigValue(param.key, checkbox.checked);
        this.onConfigChanged();
      });

      input = checkbox;
    } else if (param.type === 'number') {
      const numberInput = document.createElement('input');
      numberInput.type = 'number';
      numberInput.className = 'logic-panel__input';
      numberInput.value = String(value);

      if (param.min !== undefined) numberInput.min = String(param.min);
      if (param.max !== undefined) numberInput.max = String(param.max);
      numberInput.step = 'any';

      numberInput.addEventListener('change', () => {
        const numValue = parseFloat(numberInput.value);
        if (!isNaN(numValue)) {
          component.setConfigValue(param.key, numValue);
          this.onConfigChanged();
        }
      });

      input = numberInput;
    } else {
      // String or default
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.className = 'logic-panel__input';
      textInput.value = String(value);

      textInput.addEventListener('change', () => {
        component.setConfigValue(param.key, textInput.value);
        this.onConfigChanged();
      });

      input = textInput;
    }

    field.appendChild(input);

    return field;
  }

  private createConnectionsSection(entity: Entity): HTMLElement {
    const section = document.createElement('div');
    section.className = 'logic-panel__section';

    const heading = document.createElement('h4');
    heading.textContent = 'Connections';
    section.appendChild(heading);

    const manager = getLogicConnectionManager(entity.scene);
    if (!manager) {
      const message = document.createElement('p');
      message.textContent = 'Connection data unavailable';
      section.appendChild(message);
      return section;
    }

    const outgoing = manager.getConnectionsFromEntity(entity.id);
    const incoming = manager.getConnectionsToEntity(entity.id);

    if (outgoing.length === 0 && incoming.length === 0) {
      const message = document.createElement('p');
      message.textContent = 'No connections yet';
      section.appendChild(message);
      return section;
    }

    if (outgoing.length > 0) {
      section.appendChild(this.createConnectionGroup(entity, outgoing, 'outgoing'));
    }

    if (incoming.length > 0) {
      section.appendChild(this.createConnectionGroup(entity, incoming, 'incoming'));
    }

    return section;
  }

  private createConnectionGroup(
    entity: Entity,
    connections: LogicConnection[],
    direction: 'incoming' | 'outgoing'
  ): HTMLElement {
    const group = document.createElement('div');
    group.className = 'logic-panel__connections-group';

    const title = document.createElement('h5');
    title.textContent = direction === 'outgoing' ? 'Outgoing' : 'Incoming';
    group.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'logic-panel__connections';
    group.appendChild(list);

    const scene = entity.scene;

    for (const conn of connections) {
      const sourceEntity = scene?.findEntityById(conn.sourceEntityId) ?? null;
      const targetEntity = scene?.findEntityById(conn.targetEntityId) ?? null;

      const sourceName = sourceEntity?.name ?? conn.sourceEntityId;
      const targetName = targetEntity?.name ?? conn.targetEntityId;

      const sourcePortLabel = this.getPortLabel(sourceEntity, conn.sourcePort, 'output');
      const targetPortLabel = this.getPortLabel(targetEntity, conn.targetPort, 'input');

      const item = document.createElement('li');
      item.className = 'logic-panel__connection';

      if (direction === 'outgoing') {
        item.textContent = `${sourcePortLabel} → ${targetName} (${targetPortLabel})`;
      } else {
        item.textContent = `${sourceName} (${sourcePortLabel}) → ${targetPortLabel}`;
      }

      list.appendChild(item);
    }

    return group;
  }

  private getPortLabel(
    entity: Entity | null,
    portId: string,
    direction: 'input' | 'output'
  ): string {
    if (!entity) {
      return portId;
    }

    const component = entity.getComponent(LogicCubeComponent);
    if (!component) {
      return portId;
    }

    const entry = LogicCubeLibrary.get(component.getCubeType());
    if (!entry) {
      return portId;
    }

    const ports =
      direction === 'input' ? entry.metadata.inputs : entry.metadata.outputs;
    const port = ports.find((p) => p.id === portId);
    return port?.label ?? portId;
  }

  /**
   * Disposes the panel
   */
  dispose(): void {
    // Clean up event listeners if needed
    this.container.remove();
  }
}

