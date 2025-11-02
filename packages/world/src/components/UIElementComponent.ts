import { Component } from './Component';
import { registerComponent } from './registry';

/**
 * UI element types
 */
export type UIElementType = 'button' | 'text' | 'image' | 'slider' | 'progress' | 'input';

/**
 * Position and size for UI elements (screen-space coordinates)
 */
export interface UIPosition {
  x: number;
  y: number;
}

export interface UISize {
  width: number;
  height: number;
}

/**
 * UIElementComponent - Component for individual UI elements (button, text, image)
 */
export class UIElementComponent extends Component {
  static readonly type = 'UIElement';

  /** Unique ID for referencing this element from game logic */
  elementId: string;

  /** Type of UI element */
  type: UIElementType;

  /** Screen-space position (pixels from top-left) */
  position: UIPosition;

  /** Size in pixels */
  size: UISize;

  /** Whether element is visible */
  visible: boolean = true;

  /** Whether element is enabled (can be clicked) */
  enabled: boolean = true;

  /** Button-specific: text displayed on button */
  buttonText?: string;

  /** Text-specific: text content */
  textContent?: string;

  /** Image-specific: URL or path to image */
  imageUrl?: string;

  /** Text color (CSS color string) */
  color?: string;

  /** Background color (CSS color string) */
  backgroundColor?: string;

  /** Font size for text elements (pixels) */
  fontSize?: number;

  /** Font family for text elements */
  fontFamily?: string;

  /** Slider/Progress-specific: current value (0-1 for progress, min-max for slider) */
  value?: number;

  /** Slider-specific: minimum value */
  minValue?: number;

  /** Slider-specific: maximum value */
  maxValue?: number;

  /** Slider-specific: step size */
  step?: number;

  /** Input-specific: placeholder text */
  placeholder?: string;

  /** Input-specific: input type (text, number, password) */
  inputType?: 'text' | 'number' | 'password';

  constructor(elementId?: string, type?: UIElementType) {
    super();
    this.elementId = elementId || `ui-element-${Math.random().toString(36).substr(2, 9)}`;
    this.type = type || 'button';
    this.position = { x: 0, y: 0 };
    this.size = { width: 100, height: 40 };
  }

  getType(): string {
    return UIElementComponent.type;
  }

  clone(): UIElementComponent {
    const copy = new UIElementComponent(this.elementId, this.type);
    copy.position = { ...this.position };
    copy.size = { ...this.size };
    copy.visible = this.visible;
    copy.enabled = this.enabled;
    if (this.buttonText !== undefined) copy.buttonText = this.buttonText;
    if (this.textContent !== undefined) copy.textContent = this.textContent;
    if (this.imageUrl !== undefined) copy.imageUrl = this.imageUrl;
    if (this.color !== undefined) copy.color = this.color;
    if (this.backgroundColor !== undefined) copy.backgroundColor = this.backgroundColor;
    if (this.fontSize !== undefined) copy.fontSize = this.fontSize;
    if (this.fontFamily !== undefined) copy.fontFamily = this.fontFamily;
    if (this.value !== undefined) copy.value = this.value;
    if (this.minValue !== undefined) copy.minValue = this.minValue;
    if (this.maxValue !== undefined) copy.maxValue = this.maxValue;
    if (this.step !== undefined) copy.step = this.step;
    if (this.placeholder !== undefined) copy.placeholder = this.placeholder;
    if (this.inputType !== undefined) copy.inputType = this.inputType;
    return copy;
  }

  toJSON(): {
    elementId: string;
    type: UIElementType;
    position: UIPosition;
    size: UISize;
    visible: boolean;
    enabled: boolean;
    buttonText?: string;
    textContent?: string;
    imageUrl?: string;
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
    fontFamily?: string;
    value?: number;
    minValue?: number;
    maxValue?: number;
    step?: number;
    placeholder?: string;
    inputType?: 'text' | 'number' | 'password';
  } {
    const data: {
      elementId: string;
      type: UIElementType;
      position: UIPosition;
      size: UISize;
      visible: boolean;
      enabled: boolean;
      buttonText?: string;
      textContent?: string;
      imageUrl?: string;
      color?: string;
      backgroundColor?: string;
      fontSize?: number;
      fontFamily?: string;
      value?: number;
      minValue?: number;
      maxValue?: number;
      step?: number;
      placeholder?: string;
      inputType?: 'text' | 'number' | 'password';
    } = {
      elementId: this.elementId,
      type: this.type,
      position: { ...this.position },
      size: { ...this.size },
      visible: this.visible,
      enabled: this.enabled,
    };

    if (this.buttonText !== undefined) data.buttonText = this.buttonText;
    if (this.textContent !== undefined) data.textContent = this.textContent;
    if (this.imageUrl !== undefined) data.imageUrl = this.imageUrl;
    if (this.color !== undefined) data.color = this.color;
    if (this.backgroundColor !== undefined) data.backgroundColor = this.backgroundColor;
    if (this.fontSize !== undefined) data.fontSize = this.fontSize;
    if (this.fontFamily !== undefined) data.fontFamily = this.fontFamily;
    if (this.value !== undefined) data.value = this.value;
    if (this.minValue !== undefined) data.minValue = this.minValue;
    if (this.maxValue !== undefined) data.maxValue = this.maxValue;
    if (this.step !== undefined) data.step = this.step;
    if (this.placeholder !== undefined) data.placeholder = this.placeholder;
    if (this.inputType !== undefined) data.inputType = this.inputType;

    return data;
  }

  fromJSON(data: {
    elementId?: string;
    type?: UIElementType;
    position?: UIPosition;
    size?: UISize;
    visible?: boolean;
    enabled?: boolean;
    buttonText?: string;
    textContent?: string;
    imageUrl?: string;
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
    fontFamily?: string;
    value?: number;
    minValue?: number;
    maxValue?: number;
    step?: number;
    placeholder?: string;
    inputType?: 'text' | 'number' | 'password';
  }): void {
    if (typeof data.elementId === 'string') {
      this.elementId = data.elementId;
    }
    if (data.type && ['button', 'text', 'image', 'slider', 'progress', 'input'].includes(data.type)) {
      this.type = data.type as UIElementType;
    }
    if (data.position && typeof data.position.x === 'number' && typeof data.position.y === 'number') {
      this.position = { ...data.position };
    }
    if (data.size && typeof data.size.width === 'number' && typeof data.size.height === 'number') {
      this.size = { ...data.size };
    }
    if (typeof data.visible === 'boolean') {
      this.visible = data.visible;
    }
    if (typeof data.enabled === 'boolean') {
      this.enabled = data.enabled;
    }
    if (data.buttonText !== undefined) this.buttonText = data.buttonText;
    if (data.textContent !== undefined) this.textContent = data.textContent;
    if (data.imageUrl !== undefined) this.imageUrl = data.imageUrl;
    if (data.color !== undefined) this.color = data.color;
    if (data.backgroundColor !== undefined) this.backgroundColor = data.backgroundColor;
    if (typeof data.fontSize === 'number') this.fontSize = data.fontSize;
    if (data.fontFamily !== undefined) this.fontFamily = data.fontFamily;
    if (typeof data.value === 'number') this.value = data.value;
    if (typeof data.minValue === 'number') this.minValue = data.minValue;
    if (typeof data.maxValue === 'number') this.maxValue = data.maxValue;
    if (typeof data.step === 'number') this.step = data.step;
    if (data.placeholder !== undefined) this.placeholder = data.placeholder;
    if (data.inputType && ['text', 'number', 'password'].includes(data.inputType)) {
      this.inputType = data.inputType;
    }
  }
}

registerComponent(UIElementComponent.type, UIElementComponent);

