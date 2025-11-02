/**
 * UIElementProperties - Editor for UI element properties
 */

import type { Entity } from '@engine/world';
import { UIElementComponent, type UIElementType } from '@engine/world/components/UIElementComponent';

export interface UIElementPropertiesConfig {
  entity: Entity;
  component: UIElementComponent;
  onUpdate: (component: UIElementComponent) => void;
}

/**
 * Creates property editor for UI element component
 */
export class UIElementProperties {
  private container: HTMLElement;
  private component: UIElementComponent;
  private onUpdate: (component: UIElementComponent) => void;

  constructor(config: UIElementPropertiesConfig) {
    this.component = config.component;
    this.onUpdate = config.onUpdate;
    this.container = this.createContainer();
  }

  get element(): HTMLElement {
    return this.container;
  }

  refresh(): void {
    // Update inputs with current values
    this.updateInputs();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'ui-element-properties';

    // Element ID (readonly)
    const idRow = this.createRow('Element ID', this.component.elementId, 'readonly');
    container.appendChild(idRow);

    // Type selector
    const typeRow = this.createTypeSelector();
    container.appendChild(typeRow);

    // Position
    const positionRow = this.createPositionInputs();
    container.appendChild(positionRow);

    // Size
    const sizeRow = this.createSizeInputs();
    container.appendChild(sizeRow);

    // Visibility
    const visibleRow = this.createCheckbox('Visible', this.component.visible, (val) => {
      this.component.visible = val;
      this.onUpdate(this.component);
    });
    container.appendChild(visibleRow);

    // Enabled
    const enabledRow = this.createCheckbox('Enabled', this.component.enabled, (val) => {
      this.component.enabled = val;
      this.onUpdate(this.component);
    });
    container.appendChild(enabledRow);

    // Type-specific properties
    const typeSpecific = this.createTypeSpecificProperties();
    container.appendChild(typeSpecific);

    return container;
  }

  private createRow(label: string, value: string, type: 'readonly' | 'text' = 'text'): HTMLElement {
    const row = document.createElement('div');
    row.className = 'property-row-v2';

    const labelEl = document.createElement('label');
    labelEl.className = 'property-label-v2';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    if (type === 'readonly') {
      const valueEl = document.createElement('div');
      valueEl.className = 'property-value-readonly';
      valueEl.textContent = value;
      row.appendChild(valueEl);
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'property-input-v2';
      input.value = value;
      input.addEventListener('input', () => {
        // Handle text input changes
      });
      row.appendChild(input);
    }

    return row;
  }

  private createTypeSelector(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'property-row-v2';

    const label = document.createElement('label');
    label.className = 'property-label-v2';
    label.textContent = 'Type';
    row.appendChild(label);

    const select = document.createElement('select');
    select.className = 'property-select-v2';
    select.innerHTML = `
      <option value="button" ${this.component.type === 'button' ? 'selected' : ''}>Button</option>
      <option value="text" ${this.component.type === 'text' ? 'selected' : ''}>Text</option>
      <option value="image" ${this.component.type === 'image' ? 'selected' : ''}>Image</option>
      <option value="slider" ${this.component.type === 'slider' ? 'selected' : ''}>Slider</option>
      <option value="progress" ${this.component.type === 'progress' ? 'selected' : ''}>Progress Bar</option>
      <option value="input" ${this.component.type === 'input' ? 'selected' : ''}>Input Field</option>
    `;

    select.addEventListener('change', () => {
      const newType = select.value as UIElementType;
      if (newType !== this.component.type) {
        this.component.type = newType;
        this.onUpdate(this.component);
        // Rebuild container to show type-specific properties
        this.container.innerHTML = '';
        this.container = this.createContainer();
      }
    });

    row.appendChild(select);
    return row;
  }

  private createPositionInputs(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'property-row-v2';

    const label = document.createElement('label');
    label.className = 'property-label-v2';
    label.textContent = 'Position';
    row.appendChild(label);

    const inputs = document.createElement('div');
    inputs.className = 'property-vector-v2';

    const xInput = this.createNumberInput('X', this.component.position.x, (val) => {
      this.component.position.x = val;
      this.onUpdate(this.component);
    });

    const yInput = this.createNumberInput('Y', this.component.position.y, (val) => {
      this.component.position.y = val;
      this.onUpdate(this.component);
    });

    inputs.appendChild(xInput);
    inputs.appendChild(yInput);
    row.appendChild(inputs);

    return row;
  }

  private createSizeInputs(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'property-row-v2';

    const label = document.createElement('label');
    label.className = 'property-label-v2';
    label.textContent = 'Size';
    row.appendChild(label);

    const inputs = document.createElement('div');
    inputs.className = 'property-vector-v2';

    const widthInput = this.createNumberInput('W', this.component.size.width, (val) => {
      this.component.size.width = Math.max(1, val);
      this.onUpdate(this.component);
    });

    const heightInput = this.createNumberInput('H', this.component.size.height, (val) => {
      this.component.size.height = Math.max(1, val);
      this.onUpdate(this.component);
    });

    inputs.appendChild(widthInput);
    inputs.appendChild(heightInput);
    row.appendChild(inputs);

    return row;
  }

  private createNumberInput(
    label: string,
    value: number,
    onChange: (val: number) => void
  ): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `property-axis property-axis-${label.toLowerCase()}`;

    const axisLabel = document.createElement('span');
    axisLabel.className = 'property-axis-label';
    axisLabel.textContent = label;
    wrapper.appendChild(axisLabel);

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'property-input-v2 property-number-input';
    input.value = String(value);
    input.step = '1';
    input.addEventListener('input', () => {
      const val = parseFloat(input.value);
      if (!isNaN(val)) {
        onChange(val);
      }
    });

    wrapper.appendChild(input);
    return wrapper;
  }

  private createCheckbox(
    label: string,
    value: boolean,
    onChange: (val: boolean) => void
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'property-row-v2';

    const labelEl = document.createElement('label');
    labelEl.className = 'property-label-v2';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'property-checkbox-v2';
    checkbox.checked = value;
    checkbox.addEventListener('change', () => {
      onChange(checkbox.checked);
    });

    row.appendChild(checkbox);
    return row;
  }

  private createTypeSpecificProperties(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'ui-element-type-properties';

    switch (this.component.type) {
      case 'button':
        const buttonText = this.createTextInput('Button Text', this.component.buttonText || '', (val) => {
          this.component.buttonText = val;
          this.onUpdate(this.component);
        });
        container.appendChild(buttonText);

        const buttonColor = this.createTextInput('Color', this.component.color || '#ffffff', (val) => {
          this.component.color = val;
          this.onUpdate(this.component);
        });
        container.appendChild(buttonColor);

        const buttonBg = this.createTextInput('Background Color', this.component.backgroundColor || '', (val) => {
          this.component.backgroundColor = val === '' ? undefined : val;
          this.onUpdate(this.component);
        });
        container.appendChild(buttonBg);
        break;

      case 'text':
        const textContent = this.createTextArea('Text Content', this.component.textContent || '', (val) => {
          this.component.textContent = val;
          this.onUpdate(this.component);
        });
        container.appendChild(textContent);

        const textColor = this.createTextInput('Color', this.component.color || '#ffffff', (val) => {
          this.component.color = val;
          this.onUpdate(this.component);
        });
        container.appendChild(textColor);

        const fontSize = this.createNumberInput('Font Size', this.component.fontSize || 16, (val) => {
          this.component.fontSize = Math.max(8, val);
          this.onUpdate(this.component);
        });
        container.appendChild(fontSize);
        break;

      case 'image':
        const imageUrl = this.createTextInput('Image URL', this.component.imageUrl || '', (val) => {
          this.component.imageUrl = val === '' ? undefined : val;
          this.onUpdate(this.component);
        });
        container.appendChild(imageUrl);

        const imageBg = this.createTextInput('Background Color', this.component.backgroundColor || '', (val) => {
          this.component.backgroundColor = val === '' ? undefined : val;
          this.onUpdate(this.component);
        });
        container.appendChild(imageBg);
        break;

      case 'slider':
        const sliderValue = this.createNumberInput('Value', this.component.value ?? (this.component.minValue ?? 0), (val) => {
          this.component.value = val;
          this.onUpdate(this.component);
        });
        container.appendChild(sliderValue);

        const sliderMin = this.createNumberInput('Min Value', this.component.minValue ?? 0, (val) => {
          this.component.minValue = val;
          this.onUpdate(this.component);
        });
        container.appendChild(sliderMin);

        const sliderMax = this.createNumberInput('Max Value', this.component.maxValue ?? 100, (val) => {
          this.component.maxValue = val;
          this.onUpdate(this.component);
        });
        container.appendChild(sliderMax);

        const sliderStep = this.createNumberInput('Step', this.component.step ?? 1, (val) => {
          this.component.step = Math.max(0.01, val);
          this.onUpdate(this.component);
        });
        container.appendChild(sliderStep);

        const sliderColor = this.createTextInput('Color', this.component.color || '#64a1ff', (val) => {
          this.component.color = val;
          this.onUpdate(this.component);
        });
        container.appendChild(sliderColor);
        break;

      case 'progress':
        const progressValue = this.createNumberInput('Value (0-1)', Math.max(0, Math.min(1, this.component.value ?? 0)), (val) => {
          this.component.value = Math.max(0, Math.min(1, val));
          this.onUpdate(this.component);
        });
        container.appendChild(progressValue);

        const progressColor = this.createTextInput('Bar Color', this.component.color || '#64a1ff', (val) => {
          this.component.color = val;
          this.onUpdate(this.component);
        });
        container.appendChild(progressColor);

        const progressBg = this.createTextInput('Background Color', this.component.backgroundColor || '#1a1f35', (val) => {
          this.component.backgroundColor = val === '' ? undefined : val;
          this.onUpdate(this.component);
        });
        container.appendChild(progressBg);
        break;

      case 'input':
        const inputPlaceholder = this.createTextInput('Placeholder', this.component.placeholder || '', (val) => {
          this.component.placeholder = val === '' ? undefined : val;
          this.onUpdate(this.component);
        });
        container.appendChild(inputPlaceholder);

        const inputTypeSelect = document.createElement('div');
        inputTypeSelect.className = 'property-row-v2';
        const inputTypeLabel = document.createElement('label');
        inputTypeLabel.className = 'property-label-v2';
        inputTypeLabel.textContent = 'Input Type';
        inputTypeSelect.appendChild(inputTypeLabel);

        const inputTypeSelectEl = document.createElement('select');
        inputTypeSelectEl.className = 'property-select-v2';
        inputTypeSelectEl.innerHTML = `
          <option value="text" ${this.component.inputType === 'text' || !this.component.inputType ? 'selected' : ''}>Text</option>
          <option value="number" ${this.component.inputType === 'number' ? 'selected' : ''}>Number</option>
          <option value="password" ${this.component.inputType === 'password' ? 'selected' : ''}>Password</option>
        `;
        inputTypeSelectEl.addEventListener('change', () => {
          this.component.inputType = inputTypeSelectEl.value as 'text' | 'number' | 'password';
          this.onUpdate(this.component);
        });
        inputTypeSelect.appendChild(inputTypeSelectEl);
        container.appendChild(inputTypeSelect);

        if (this.component.inputType === 'number') {
          const inputValue = this.createNumberInput('Default Value', this.component.value ?? 0, (val) => {
            this.component.value = val;
            this.onUpdate(this.component);
          });
          container.appendChild(inputValue);

          const inputMin = this.createNumberInput('Min', this.component.minValue ?? 0, (val) => {
            this.component.minValue = val;
            this.onUpdate(this.component);
          });
          container.appendChild(inputMin);

          const inputMax = this.createNumberInput('Max', this.component.maxValue ?? 100, (val) => {
            this.component.maxValue = val;
            this.onUpdate(this.component);
          });
          container.appendChild(inputMax);
        } else {
          const inputText = this.createTextInput('Default Text', this.component.textContent || '', (val) => {
            this.component.textContent = val === '' ? undefined : val;
            this.onUpdate(this.component);
          });
          container.appendChild(inputText);
        }

        const inputColor = this.createTextInput('Text Color', this.component.color || '#ffffff', (val) => {
          this.component.color = val;
          this.onUpdate(this.component);
        });
        container.appendChild(inputColor);

        const inputBg = this.createTextInput('Background Color', this.component.backgroundColor || '#1a1f35', (val) => {
          this.component.backgroundColor = val === '' ? undefined : val;
          this.onUpdate(this.component);
        });
        container.appendChild(inputBg);
        break;
    }

    return container;
  }

  private createTextInput(
    label: string,
    value: string,
    onChange: (val: string) => void
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'property-row-v2';

    const labelEl = document.createElement('label');
    labelEl.className = 'property-label-v2';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'property-input-v2';
    input.value = value;
    input.addEventListener('input', () => {
      onChange(input.value);
    });

    row.appendChild(input);
    return row;
  }

  private createTextArea(
    label: string,
    value: string,
    onChange: (val: string) => void
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'property-row-v2';

    const labelEl = document.createElement('label');
    labelEl.className = 'property-label-v2';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const textarea = document.createElement('textarea');
    textarea.className = 'property-textarea-v2';
    textarea.value = value;
    textarea.rows = 3;
    textarea.addEventListener('input', () => {
      onChange(textarea.value);
    });

    row.appendChild(textarea);
    return row;
  }

  private updateInputs(): void {
    // Update all input values to match current component state
    // This is called when component changes externally
  }
}

