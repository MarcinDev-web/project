import init, { VMWrapper } from '../../../../crates/script-vm/pkg/script_vm.js';
import type { Scene } from '@engine/world';
import { GraphCompiler, type GraphData } from './compiler/GraphCompiler.js';
import { LogicCubeComponent } from '../components/LogicCubeComponent.js';

import type { LogicCubeSystem } from './LogicCubeSystem.js';

export class WasmLogicRuntime {
  private vm: VMWrapper | null = null;
  private initialized = false;
  private scene: Scene;
  
  constructor(scene: Scene) {
    this.scene = scene;
  }
  
  async init(): Promise<void> {
    if (this.initialized) return;
    
    await init();
    this.vm = new VMWrapper();
    this.initialized = true;
  }
  
  compileAndLoad(logicSystem: LogicCubeSystem): void {
    if (!this.vm) return;
    
    // Gather all data from Scene
    const graphData: GraphData = {
      nodes: [],
      connections: []
    };

    const idMap = new Map<string, number>();
    let nextId = 1;
    
    // 1. Nodes
    const entities = this.scene.queryEntities(LogicCubeComponent);
    for (const entity of entities) {
      const comp = entity.getComponent(LogicCubeComponent);
      if (comp) {
        const numericId = nextId++;
        idMap.set(entity.id, numericId);

        graphData.nodes.push({
          id: numericId,
          type: comp.getCubeType(),
          config: comp.getConfig()
        });
      }
    }
    
    // 2. Connections
    const connectionManager = logicSystem.getConnectionManager();
    const connections = connectionManager.getAllConnections();
    
    for (const conn of connections) {
        const sourceId = idMap.get(conn.sourceEntityId);
        const targetId = idMap.get(conn.targetEntityId);

        if (sourceId !== undefined && targetId !== undefined) {
            graphData.connections.push({
                sourceNode: sourceId,
                sourcePort: conn.sourcePort,
                targetNode: targetId,
                targetPort: conn.targetPort
            });
        }
    }
    
    const binary = GraphCompiler.compile(graphData);
    try {
        this.vm.load_graph(binary);
        console.log(`WASM Graph loaded: ${binary.byteLength} bytes`);
    } catch (e) {
        console.error("Failed to load WASM graph:", e);
    }
  }
  
  update(dt: number): void {
    if (!this.vm) return;
    
    const sideEffects = this.vm.step(dt);
    if (sideEffects.length > 0) {
        // Process side effects
        // [Cmd, Param1, Param2...]
    }
  }
}

