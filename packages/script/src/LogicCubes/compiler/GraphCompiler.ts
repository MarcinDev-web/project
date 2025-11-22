export interface GraphNode {
  id: number;
  type: string;
  config: Record<string, unknown>;
}

export interface GraphConnection {
  sourceNode: number;
  sourcePort: string;
  targetNode: number;
  targetPort: string;
}

export interface GraphData {
  nodes: GraphNode[];
  connections: GraphConnection[];
}

const TYPE_MAPPING: Record<string, number> = {
  'trigger': 0,
  'delayGate': 1,
  'timerData': 2,
  'counterData': 3,
  
  'andGate': 10,
  'orGate': 11,
  'notGate': 12,
  'xorGate': 13,
  
  'variableData': 20,
  // 'constNumber': 22,
};

const PORT_MAPPING: Record<string, Record<string, number>> = {
  'andGate': { 'inputA': 0, 'inputB': 1, 'output': 0 },
  'orGate': { 'inputA': 0, 'inputB': 1, 'output': 0 },
  'delayGate': { 'input': 0, 'output': 0 },
  'timerData': { 'start': 0, 'stop': 1, 'reset': 2, 'elapsed': 0, 'onComplete': 1 },
  'variableData': { 'set': 0, 'get': 1, 'value': 0, 'onSet': 1 },
  // Add others as needed
};

export class GraphCompiler {
  static compile(graph: GraphData): Uint8Array {
    // Estimate size: 
    // Header (8) + Nodes Count (4) + Nodes * ~20 + Conns Count (4) + Conns * 10
    const estimatedSize = 1024 + graph.nodes.length * 64 + graph.connections.length * 16;
    const buffer = new ArrayBuffer(estimatedSize);
    const view = new DataView(buffer);
    let offset = 0;
    
    // Magic "LGCB"
    view.setUint8(offset++, 76); // L
    view.setUint8(offset++, 71); // G
    view.setUint8(offset++, 67); // C
    view.setUint8(offset++, 66); // B
    
    // Version 1
    view.setUint32(offset, 1, true);
    offset += 4;
    
    // Nodes Section
    view.setUint32(offset, graph.nodes.length, true);
    offset += 4;
    
    for (const node of graph.nodes) {
      view.setUint32(offset, node.id, true);
      offset += 4;
      
      const typeId = TYPE_MAPPING[node.type] || 255; // Unknown
      view.setUint16(offset, typeId, true);
      offset += 2;
      
      // Config serialization
      const configBytes = this.serializeConfig(node.type, node.config);
      view.setUint16(offset, configBytes.length, true);
      offset += 2;
      
      // Write config bytes
      new Uint8Array(buffer, offset, configBytes.length).set(configBytes);
      offset += configBytes.length;
    }
    
    // Connections Section
    view.setUint32(offset, graph.connections.length, true);
    offset += 4;
    
    for (const conn of graph.connections) {
      view.setUint32(offset, conn.sourceNode, true);
      offset += 4;
      
      const srcPortId = this.getPortId(graph.nodes.find(n => n.id === conn.sourceNode)?.type || '', conn.sourcePort);
      view.setUint8(offset++, srcPortId);
      
      view.setUint32(offset, conn.targetNode, true);
      offset += 4;
      
      const targetPortId = this.getPortId(graph.nodes.find(n => n.id === conn.targetNode)?.type || '', conn.targetPort);
      view.setUint8(offset++, targetPortId);
    }
    
    return new Uint8Array(buffer, 0, offset);
  }
  
  private static serializeConfig(type: string, config: Record<string, unknown>): Uint8Array {
    if (type === 'variableData') {
      // String name
      const name = (config['variableName'] as string) || 'var';
      return new TextEncoder().encode(name);
    } else if (type === 'timerData') {
        // Float duration
        const duration = (config['duration'] as number) || 1.0;
        const buf = new ArrayBuffer(4);
        new DataView(buf).setFloat32(0, duration, true);
        return new Uint8Array(buf);
    } else if (type === 'delayGate') {
        // Float delay
        const delay = (config['delay'] as number) || 1.0;
        const buf = new ArrayBuffer(4);
        new DataView(buf).setFloat32(0, delay, true);
        return new Uint8Array(buf);
    }
    return new Uint8Array(0);
  }
  
  private static getPortId(type: string, portName: string): number {
    const mapping = PORT_MAPPING[type];
    if (mapping && mapping[portName] !== undefined) {
      return mapping[portName];
    }
    return 0; // Default/Fallback
  }
}

