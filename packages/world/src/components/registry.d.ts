import type { ComponentClass } from './Component.js';
export declare function registerComponent(type: string, ctor: ComponentClass): void;
export declare function getComponentConstructor(type: string): ComponentClass | undefined;
export declare function getRegisteredComponentTypes(): string[];
//# sourceMappingURL=registry.d.ts.map