import type { ComponentClass } from './Component';

const registry = new Map<string, ComponentClass>();

export function registerComponent(type: string, ctor: ComponentClass): void {
  registry.set(type, ctor);
}

export function getComponentConstructor(type: string): ComponentClass | undefined {
  return registry.get(type);
}

export function getRegisteredComponentTypes(): string[] {
  return Array.from(registry.keys());
}
