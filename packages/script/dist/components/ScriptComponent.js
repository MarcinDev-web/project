import { Component } from '@engine/world';
import { registerComponent } from '@engine/world';
import { BehaviorRegistry } from '../behavior/BehaviorRegistry';
export class ScriptComponent extends Component {
    static type = 'Script';
    scripts = [];
    instances = [];
    getType() {
        return ScriptComponent.type;
    }
    /** Returns a copy of script definitions. */
    getScriptDefinitions() {
        return this.scripts.map((s) => ({
            name: s.name,
            ...(s.params ? { params: { ...s.params } } : {}),
            enabled: s.enabled ?? true,
        }));
    }
    /** Returns active behavior instances. */
    getInstances() {
        return this.instances.slice();
    }
    clone() {
        const copy = new ScriptComponent();
        // Deep-copy script definitions; instances are not cloned
        copy.scripts = this.getScriptDefinitions();
        return copy;
    }
    addScript(def) {
        const cloned = {
            name: def.name,
            ...(def.params ? { params: { ...def.params } } : {}),
            enabled: def.enabled ?? true,
        };
        this.scripts.push(cloned);
        this.tryInstantiate(cloned);
    }
    removeScriptByName(name) {
        let removed = false;
        this.scripts = this.scripts.filter((s, i) => {
            if (s.name === name && !removed) {
                removed = true;
                const inst = this.instances[i];
                if (inst)
                    this.destroyInstance(inst);
                this.instances.splice(i, 1);
                return false;
            }
            return true;
        });
        return removed;
    }
    onAttach() {
        // Instantiate all scripts
        for (const def of this.scripts) {
            this.tryInstantiate(def);
        }
    }
    onDetach() {
        // Destroy instances
        const scene = this.entity?.scene ?? null;
        for (const inst of this.instances) {
            this.destroyInstance(inst, scene);
        }
        this.instances = [];
        const entity = this.entity;
        const runtime = scene?.scriptRuntime;
        if (scene && entity && runtime) {
            runtime.contextBuilder?.invalidate?.(entity.id);
        }
    }
    toJSON() {
        return { scripts: this.getScriptDefinitions() };
    }
    fromJSON(data) {
        if (!data || typeof data !== 'object')
            return;
        if (!Array.isArray(data.scripts))
            return;
        this.scripts = data.scripts.map((s) => ({
            name: s.name,
            ...(s.params ? { params: { ...s.params } } : {}),
            enabled: s.enabled ?? true,
        }));
    }
    /**
     * Rebuild instances after hot-reload: destroys and re-instantiates.
     */
    rebuildInstances() {
        for (const inst of this.instances)
            this.destroyInstance(inst);
        this.instances = [];
        for (const def of this.scripts)
            this.tryInstantiate(def);
    }
    /**
     * Replaces script definitions and rebuilds instances. Useful for editor UI updates.
     */
    setScripts(defs) {
        this.scripts = defs.map((s) => ({
            name: s.name,
            ...(s.params ? { params: { ...s.params } } : {}),
            enabled: s.enabled ?? true,
        }));
        this.rebuildInstances();
    }
    tryInstantiate(def) {
        const entity = this.entity;
        const scene = entity?.scene;
        if (!entity || !scene)
            return;
        const ctor = BehaviorRegistry.get(def.name);
        if (!ctor)
            return; // behavior not registered yet
        const runtime = scene.scriptRuntime;
        const services = (runtime?.contextBuilder).getServices(entity);
        // Lazy import: create instance with context
        const context = {
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
        }
        catch {
            // ignore script init errors
        }
        this.instances.push(instance);
    }
    destroyInstance(inst, scene = null) {
        const currentScene = scene ?? this.entity?.scene ?? null;
        try {
            inst.onDestroy();
        }
        catch {
            // ignore script destroy errors
        }
        const runtime = currentScene?.scriptRuntime;
        runtime?.scheduler?.detachBehaviorInstance?.(inst);
        runtime?.behaviors?.delete?.(inst);
    }
}
registerComponent(ScriptComponent.type, ScriptComponent);
//# sourceMappingURL=ScriptComponent.js.map