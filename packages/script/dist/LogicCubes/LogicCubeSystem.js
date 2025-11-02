/**
 * LogicCubeSystem - Manages execution of logic cubes in the scene.
 * Similar to ScriptSystem but for visual logic cubes.
 */
import { LogicCubeComponent } from '../components/LogicCubeComponent';
import { LogicConnectionManager } from '../connection/LogicConnectionManager';
import { registerLogicConnectionManager } from '../connection/LogicConnectionRegistry';
import { VariableStorage } from '../storage/VariableStorage';
import { PlayerDetection } from './cubes/PlayerDetection';
import { Logger } from '@engine/core/utils';
/**
 * Registry for logic cube types
 */
class LogicCubeRegistry {
    static cubes = new Map();
    static register(type, ctor) {
        this.cubes.set(type, ctor);
    }
    static get(type) {
        return this.cubes.get(type);
    }
    static has(type) {
        return this.cubes.has(type);
    }
    static list() {
        return Array.from(this.cubes.keys());
    }
}
// Export registry for use by cube implementations
export { LogicCubeRegistry };
/**
 * Main system for managing logic cubes
 */
export class LogicCubeSystem {
    scene;
    connectionManager;
    variableStorage;
    playerDetection;
    /** Map of entity ID -> logic cube instance */
    cubeInstances = new Map();
    /** Queue of signals to process this frame */
    signalQueue = [];
    /** Total game time */
    gameTime = 0;
    /** Max signals to process per frame (prevent infinite loops) */
    maxSignalsPerFrame = 1000;
    constructor(scene) {
        this.scene = scene;
        this.connectionManager = new LogicConnectionManager();
        this.variableStorage = new VariableStorage();
        this.playerDetection = new PlayerDetection(scene);
        registerLogicConnectionManager(scene, this.connectionManager);
        // Listen for external logic signals (e.g., from UI events)
        scene.events.on('logic:signal', (event) => {
            const { targetEntityId, targetPort, signal } = event.payload || {};
            if (targetEntityId && targetPort && signal) {
                this.signalQueue.push({
                    targetEntityId,
                    targetPort,
                    signal,
                });
            }
        });
    }
    /**
     * Gets the connection manager
     */
    getConnectionManager() {
        return this.connectionManager;
    }
    /**
     * Gets the variable storage
     */
    getVariableStorage() {
        return this.variableStorage;
    }
    /**
     * Gets the player detection helper
     */
    getPlayerDetection() {
        return this.playerDetection;
    }
    /**
     * Update loop - called every frame
     */
    update(deltaTime) {
        if (!Number.isFinite(deltaTime) || deltaTime < 0)
            return;
        this.gameTime += deltaTime;
        const context = {
            deltaTime,
            gameTime: this.gameTime,
        };
        // Ensure all logic cube entities have instances
        this.ensureInstances();
        // Update all cube instances (for timers, cooldowns, etc.)
        for (const [entityId, cube] of this.cubeInstances) {
            if (cube.enabled) {
                cube.onUpdate(context);
                // Update component cooldown
                const entity = this.scene.findEntityById(entityId);
                if (entity) {
                    const component = entity.getComponent(LogicCubeComponent);
                    if (component) {
                        component.updateCooldown(deltaTime);
                    }
                }
            }
        }
        // Process signal queue
        this.processSignalQueue(context);
    }
    /**
     * Ensures all LogicCubeComponents have corresponding cube instances
     */
    ensureInstances() {
        const entities = this.scene.queryEntities(LogicCubeComponent);
        for (const entity of entities) {
            if (!this.cubeInstances.has(entity.id)) {
                this.createCubeInstance(entity.id);
            }
        }
        // Remove instances for deleted entities
        for (const entityId of this.cubeInstances.keys()) {
            const entity = this.scene.findEntityById(entityId);
            if (!entity || !entity.getComponent(LogicCubeComponent)) {
                this.destroyCubeInstance(entityId);
            }
        }
    }
    /**
     * Creates a cube instance for an entity
     */
    createCubeInstance(entityId) {
        const entity = this.scene.findEntityById(entityId);
        if (!entity)
            return;
        const component = entity.getComponent(LogicCubeComponent);
        if (!component)
            return;
        const cubeType = component.getCubeType();
        if (!cubeType)
            return;
        const ctor = LogicCubeRegistry.get(cubeType);
        if (!ctor) {
            Logger.warn(`Unknown logic cube type: ${cubeType}`);
            return;
        }
        try {
            const config = component.getConfig();
            const cube = new ctor(entity, this.scene, config);
            cube.enabled = component.isEnabled();
            // Restore state
            const savedState = component.getAllState();
            if (savedState && Object.keys(savedState).length > 0) {
                cube.fromJSON({
                    config,
                    state: savedState,
                    cooldown: component.getCooldown(),
                });
            }
            cube.onInit();
            this.cubeInstances.set(entityId, cube);
        }
        catch (error) {
            Logger.error(`Failed to create logic cube instance for ${cubeType}:`, error);
        }
    }
    /**
     * Destroys a cube instance
     */
    destroyCubeInstance(entityId) {
        const cube = this.cubeInstances.get(entityId);
        if (cube) {
            try {
                cube.onDestroy();
            }
            catch (error) {
                Logger.warn(`Error destroying logic cube:`, error);
            }
            this.cubeInstances.delete(entityId);
        }
    }
    /**
     * Emits a signal from an output port
     */
    emitSignal(sourceEntityId, sourcePort, signal) {
        // Find all connections from this port
        const connections = this.connectionManager.getConnectionsFromPort(sourceEntityId, sourcePort);
        for (const conn of connections) {
            this.signalQueue.push({
                targetEntityId: conn.targetEntityId,
                targetPort: conn.targetPort,
                signal,
            });
        }
    }
    /**
     * Processes the signal queue
     */
    processSignalQueue(context) {
        let processed = 0;
        while (this.signalQueue.length > 0 && processed < this.maxSignalsPerFrame) {
            const item = this.signalQueue.shift();
            if (!item)
                break;
            processed++;
            const cube = this.cubeInstances.get(item.targetEntityId);
            if (!cube || !cube.enabled)
                continue;
            if (!cube.canReceiveSignal(item.targetPort))
                continue;
            try {
                const signalContext = {
                    ...context,
                    signal: item.signal,
                };
                const outputSignals = cube.onSignalReceived(item.targetPort, item.signal, signalContext);
                // Emit output signals
                if (outputSignals && outputSignals.size > 0) {
                    for (const [outputPort, outputSignal] of outputSignals) {
                        this.emitSignal(item.targetEntityId, outputPort, outputSignal);
                    }
                }
            }
            catch (error) {
                Logger.error(`Error processing signal for entity ${item.targetEntityId}:`, error);
            }
        }
        if (this.signalQueue.length > 0) {
            Logger.warn(`Signal queue overflow: ${this.signalQueue.length} signals dropped to prevent infinite loop`);
            this.signalQueue = [];
        }
    }
    /**
     * Manually triggers a logic cube (useful for editor/debugging)
     */
    triggerCube(entityId, inputPort = 'trigger') {
        const signal = {
            type: 'trigger',
            sourceEntityId: entityId,
            timestamp: this.gameTime,
        };
        this.signalQueue.push({
            targetEntityId: entityId,
            targetPort: inputPort,
            signal,
        });
    }
    /**
     * Gets a cube instance by entity ID
     */
    getCubeInstance(entityId) {
        return this.cubeInstances.get(entityId);
    }
    /**
     * Resets the system
     */
    reset() {
        // Destroy all instances
        for (const entityId of this.cubeInstances.keys()) {
            this.destroyCubeInstance(entityId);
        }
        this.cubeInstances.clear();
        this.signalQueue = [];
        this.gameTime = 0;
        this.variableStorage.clear();
    }
    /**
     * Serializes the system state
     */
    toJSON() {
        return {
            connections: this.connectionManager.toJSON(),
            variables: this.variableStorage.toJSON(),
            gameTime: this.gameTime,
        };
    }
    /**
     * Restores the system state
     */
    fromJSON(data) {
        if (data.connections) {
            this.connectionManager.fromJSON(data.connections);
        }
        if (data.variables) {
            this.variableStorage.fromJSON(data.variables);
        }
        if (typeof data.gameTime === 'number') {
            this.gameTime = data.gameTime;
        }
    }
}
//# sourceMappingURL=LogicCubeSystem.js.map