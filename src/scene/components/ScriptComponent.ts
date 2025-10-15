import { Component } from './Component';
import { registerComponent } from './registry';
import type { Scene } from '../Scene';
import type { BehaviorConstructor, BehaviorInstance, BehaviorContext } from '../../logic/Behavior';
import { BehaviorRegistry } from '../../logic/BehaviorRegistry';

export interface ScriptDefinition {
  /** Registry name for behavior constructor */
  name: string;
  /** Optional params persisted with the script */
  params?: Record<string, unknown>;
  /** Start enabled flag (default true) */
  enabled?: boolean;
}

export interface ScriptComponentState {
  scripts: ScriptDefinition[];
}

export class ScriptComponent extends Component {
  static readonly type = 'Script';

  private scripts: ScriptDefinition[] = [];
  private instances: BehaviorInstance[] = [];

  getType(): string {
    return ScriptComponent.type;
  }

  /** Returns a copy of script definitions. */
  getScriptDefinitions(): ScriptDefinition[] {
    return this.scripts.map((s) => ({
      name: s.name,
      ...(s.params ? { params: { ...s.params } } : {}),
      enabled: s.enabled ?? true,
    }));
  }

  /** Returns active behavior instances. */
  getInstances(): BehaviorInstance[] {
    return this.instances.slice();
  }

  override clone(): ScriptComponent {
    const copy = new ScriptComponent();
    // Deep-copy script definitions; instances are not cloned
    copy.scripts = this.getScriptDefinitions();
    return copy;
  }

  addScript(def: ScriptDefinition): void {
    const cloned: ScriptDefinition = {
      name: def.name,
      ...(def.params ? { params: { ...def.params } } : {}),
      enabled: def.enabled ?? true,
    };
    this.scripts.push(cloned);
    this.tryInstantiate(cloned);
  }

  removeScriptByName(name: string): boolean {
    let removed = false;
    this.scripts = this.scripts.filter((s, i) => {
      if (s.name === name && !removed) {
        removed = true;
        const inst = this.instances[i];
        if (inst) this.destroyInstance(inst);
        this.instances.splice(i, 1);
        return false;
      }
      return true;
    });
    return removed;
  }

  override onAttach(): void {
    // Instantiate all scripts
    for (const def of this.scripts) {
      this.tryInstantiate(def);
    }
  }

  override onDetach(): void {
    // Destroy instances
    const scene = this.entity?.scene ?? null;
    for (const inst of this.instances) {
      this.destroyInstance(inst, scene);
    }
    this.instances = [];
    const entity = this.entity;
    if (scene && entity) {
      scene.scriptRuntime?.contextBuilder.invalidate(entity.id);
    }
  }

  toJSON(): ScriptComponentState {
    return { scripts: this.getScriptDefinitions() };
  }

  fromJSON(data: ScriptComponentState): void {
    if (!data || typeof data !== 'object') return;
    if (!Array.isArray(data.scripts)) return;
    this.scripts = data.scripts.map((s) => ({
      name: s.name,
      ...(s.params ? { params: { ...s.params } } : {}),
      enabled: s.enabled ?? true,
    }));
  }

  /**
   * Rebuild instances after hot-reload: destroys and re-instantiates.
   */
  rebuildInstances(): void {
    for (const inst of this.instances) this.destroyInstance(inst);
    this.instances = [];
    for (const def of this.scripts) this.tryInstantiate(def);
  }

  /**
   * Replaces script definitions and rebuilds instances. Useful for editor UI updates.
   */
  setScripts(defs: ScriptDefinition[]): void {
    this.scripts = defs.map((s) => ({
      name: s.name,
      ...(s.params ? { params: { ...s.params } } : {}),
      enabled: s.enabled ?? true,
    }));
    this.rebuildInstances();
  }

  private tryInstantiate(def: ScriptDefinition): void {
    const entity = this.entity;
    const scene = entity?.scene;
    if (!entity || !scene) return;

    const ctor = BehaviorRegistry.get(def.name) as BehaviorConstructor | undefined;
    if (!ctor) return; // behavior not registered yet

    const runtime = scene.scriptRuntime;
    const services = runtime?.contextBuilder.getServices(entity);

    // Lazy import: create instance with context
    const context: BehaviorContext = {
      entity,
      scene,
      events: scene.events,
      ...(services != null ? { services } : {}),
    };
    const instance = new ctor(context, def.params);
    instance.enabled = def.enabled ?? true;
    if (runtime) {
      runtime.behaviors.add(instance);
      runtime.scheduler.attachBehaviorInstance(instance);
    }
    try {
      instance.onInit();
    } catch {
      // ignore script init errors
    }
    this.instances.push(instance);
  }

  private destroyInstance(inst: BehaviorInstance, scene: Scene | null = null): void {
    const currentScene = scene ?? this.entity?.scene ?? null;
    try {
      inst.onDestroy();
    } catch {
      // ignore script destroy errors
    }
    const runtime = currentScene?.scriptRuntime;
    runtime?.scheduler.detachBehaviorInstance(inst);
    runtime?.behaviors.delete(inst);
  }
}

registerComponent(ScriptComponent.type, ScriptComponent);


