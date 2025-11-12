import { Component } from './Component.js';
/**
 * UICanvasComponent - Main UI container component
 * Each entity with this component represents a UI canvas overlay
 */
export declare class UICanvasComponent extends Component {
    static readonly type = "UICanvas";
    /** Whether the canvas is enabled and visible */
    enabled: boolean;
    /** Z-index for layer ordering (higher = on top) */
    zIndex: number;
    /** Optional background color for the canvas */
    backgroundColor?: string;
    getType(): string;
    clone(): UICanvasComponent;
    toJSON(): {
        enabled: boolean;
        zIndex: number;
        backgroundColor?: string;
    };
    fromJSON(data: {
        enabled?: boolean;
        zIndex?: number;
        backgroundColor?: string;
    }): void;
}
//# sourceMappingURL=UICanvasComponent.d.ts.map