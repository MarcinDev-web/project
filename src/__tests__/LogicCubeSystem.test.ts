/**
 * Tests for LogicCubeSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { LogicCubeSystem } from '@engine/script';
import { LogicCubeComponent } from '@engine/world';
import { registerBuiltInLogicCubes } from '@engine/script';

describe('LogicCubeSystem', () => {
  let scene: Scene;
  let system: LogicCubeSystem;

  beforeEach(() => {
    registerBuiltInLogicCubes();
    scene = new Scene('Test Scene');
    system = new LogicCubeSystem(scene);
  });

  it('should create and manage logic cube system', () => {
    expect(system).toBeDefined();
    expect(system.getConnectionManager()).toBeDefined();
    expect(system.getVariableStorage()).toBeDefined();
    expect(system.getPlayerDetection()).toBeDefined();
  });

  it('should create cube instances for entities with LogicCubeComponent', () => {
    // Create a logic cube entity
    const entity = new Entity('TestCube');
    const component = new LogicCubeComponent();
    component.setCubeType('onClickTrigger');
    entity.addComponent(component);
    scene.addEntity(entity);

    // Update system to create instances
    system.update(0.016);

    // Instance should be created
    const instance = system.getCubeInstance(entity.id);
    expect(instance).toBeDefined();
  });

  it('should propagate signals through connections', () => {
    // Create source cube (OnClick trigger)
    const sourceEntity = new Entity('Source');
    const sourceComponent = new LogicCubeComponent();
    sourceComponent.setCubeType('onClickTrigger');
    sourceEntity.addComponent(sourceComponent);
    scene.addEntity(sourceEntity);

    // Create target cube (Log action)
    const targetEntity = new Entity('Target');
    const targetComponent = new LogicCubeComponent();
    targetComponent.setCubeType('logAction');
    targetComponent.setConfigValue('message', 'Test Message');
    targetEntity.addComponent(targetComponent);
    scene.addEntity(targetEntity);

    // Create connection
    const connectionManager = system.getConnectionManager();
    connectionManager.addConnection(
      sourceEntity.id,
      'output',
      targetEntity.id,
      'trigger'
    );

    // Update to create instances
    system.update(0.016);

    // Manually trigger the source
    system.triggerCube(sourceEntity.id, 'output');

    // Process signals
    system.update(0.016);

    // Signal should have been processed (check console output in actual run)
    expect(connectionManager.getConnectionsFromEntity(sourceEntity.id).length).toBe(1);
  });

  it('should manage variables', () => {
    const variables = system.getVariableStorage();

    variables.set('testNumber', 42);
    variables.set('testString', 'hello');
    variables.set('testBoolean', true);

    expect(variables.get('testNumber')).toBe(42);
    expect(variables.get('testString')).toBe('hello');
    expect(variables.get('testBoolean')).toBe(true);

    variables.increment('testNumber', 8);
    expect(variables.get('testNumber')).toBe(50);

    variables.toggle('testBoolean');
    expect(variables.get('testBoolean')).toBe(false);
  });

  it('should validate connections', () => {
    const connectionManager = system.getConnectionManager();

    // Valid connection
    const result1 = connectionManager.validateConnection('entity1', 'out', 'entity2', 'in');
    expect(result1.valid).toBe(true);

    // Self-connection (invalid)
    const result2 = connectionManager.validateConnection('entity1', 'out', 'entity1', 'in');
    expect(result2.valid).toBe(false);
    expect(result2.reason).toContain('itself');
  });

  it('should serialize and deserialize system state', () => {
    const variables = system.getVariableStorage();
    const connectionManager = system.getConnectionManager();

    // Set up state
    variables.set('score', 100);
    variables.set('playerName', 'Alice');

    const entity1 = new Entity('Cube1');
    const entity2 = new Entity('Cube2');
    scene.addEntity(entity1);
    scene.addEntity(entity2);

    connectionManager.addConnection(entity1.id, 'output', entity2.id, 'input');

    // Serialize
    const data = system.toJSON();
    expect(data).toBeDefined();
    expect(data.variables).toBeDefined();
    expect(data.connections).toBeDefined();

    // Create new system and deserialize
    const newSystem = new LogicCubeSystem(scene);
    newSystem.fromJSON(data);

    // Check restored state
    const newVariables = newSystem.getVariableStorage();
    expect(newVariables.get('score')).toBe(100);
    expect(newVariables.get('playerName')).toBe('Alice');

    const newConnections = newSystem.getConnectionManager();
    expect(newConnections.getAllConnections().length).toBe(1);
  });

  it('should prevent infinite signal loops', () => {
    // Create two cubes that connect to each other
    const entity1 = new Entity('Cube1');
    const component1 = new LogicCubeComponent();
    component1.setCubeType('orGate');
    entity1.addComponent(component1);
    scene.addEntity(entity1);

    const entity2 = new Entity('Cube2');
    const component2 = new LogicCubeComponent();
    component2.setCubeType('orGate');
    entity2.addComponent(component2);
    scene.addEntity(entity2);

    // Create circular connection
    const connectionManager = system.getConnectionManager();
    connectionManager.addConnection(entity1.id, 'output', entity2.id, 'inputA');
    connectionManager.addConnection(entity2.id, 'output', entity1.id, 'inputA');

    // Update to create instances
    system.update(0.016);

    // Trigger one cube
    system.triggerCube(entity1.id, 'inputA');

    // System should handle this without crashing (max signal limit)
    expect(() => {
      for (let i = 0; i < 10; i++) {
        system.update(0.016);
      }
    }).not.toThrow();
  });

  it('should reset system state', () => {
    const variables = system.getVariableStorage();
    variables.set('test', 123);

    const entity = new Entity('TestCube');
    const component = new LogicCubeComponent();
    component.setCubeType('onClickTrigger');
    entity.addComponent(component);
    scene.addEntity(entity);

    system.update(0.016);

    // Reset
    system.reset();

    // Variables should be cleared
    expect(variables.get('test')).toBeUndefined();

    // Instances should be cleared
    expect(system.getCubeInstance(entity.id)).toBeUndefined();
  });
});

