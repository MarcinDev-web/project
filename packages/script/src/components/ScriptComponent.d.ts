import { Component } from '@engine/world';
import type { BehaviorInstance } from '../behavior/Behavior';
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
export declare class ScriptComponent extends Component {
    static readonly type = "Script";
    private scripts;
    private instances;
    getType(): string;
    /** Returns a copy of script definitions. */
    getScriptDefinitions(): ScriptDefinition[];
    /** Returns active behavior instances. */
    getInstances(): BehaviorInstance[];
    clone(): ScriptComponent;
    addScript(def: ScriptDefinition): void;
    removeScriptByName(name: string): boolean;
    onAttach(): void;
    onDetach(): void;
    toJSON(): ScriptComponentState;
    fromJSON(data: ScriptComponentState): void;
    /**
     * Rebuild instances after hot-reload: destroys and re-instantiates.
     */
    rebuildInstances(): void;
    /**
     * Replaces script definitions and rebuilds instances. Useful for editor UI updates.
     */
    setScripts(defs: ScriptDefinition[]): void;
    private tryInstantiate;
    private destroyInstance;
}
//# sourceMappingURL=ScriptComponent.d.ts.map