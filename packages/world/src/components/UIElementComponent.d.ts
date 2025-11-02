import { Component } from './Component';
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
export declare class UIElementComponent extends Component {
    static readonly type = "UIElement";
    /** Unique ID for referencing this element from game logic */
    elementId: string;
    /** Type of UI element */
    type: UIElementType;
    /** Screen-space position (pixels from top-left) */
    position: UIPosition;
    /** Size in pixels */
    size: UISize;
    /** Whether element is visible */
    visible: boolean;
    /** Whether element is enabled (can be clicked) */
    enabled: boolean;
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
    constructor(elementId?: string, type?: UIElementType);
    getType(): string;
    clone(): UIElementComponent;
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
    };
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
    }): void;
}
//# sourceMappingURL=UIElementComponent.d.ts.map