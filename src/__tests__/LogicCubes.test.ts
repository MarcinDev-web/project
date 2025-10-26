/**
 * Tests for individual Logic Cube types
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import {
  OnClickTrigger,
  OnTimerTrigger,
  OnGameStartTrigger,
} from '@engine/script';
import {
  SendMessageAction,
  SetVariableAction,
  LogAction,
} from '@engine/script';
import {
  CompareVariableCondition,
} from '@engine/script';
import {
  VariableData,
  CounterData,
  TimerData,
} from '@engine/script';
import {
  ANDGate,
  ORGate,
  NOTGate,
  DelayGate,
} from '@engine/script';

describe('Logic Cubes', () => {
  let scene: Scene;
  let entity: Entity;

  beforeEach(() => {
    scene = new Scene('Test Scene');
    entity = new Entity('TestEntity');
    scene.addEntity(entity);
  });

  describe('Trigger Cubes', () => {
    it('OnClickTrigger should have correct metadata', () => {
      const cube = new OnClickTrigger(entity, scene);
      const metadata = cube.getMetadata();

      expect(metadata.type).toBe('onClickTrigger');
      expect(metadata.category).toBe('trigger');
      expect(metadata.outputs.length).toBeGreaterThan(0);
      expect(metadata.parameters.length).toBeGreaterThan(0);
    });

    it('OnTimerTrigger should fire at intervals', () => {
      const cube = new OnTimerTrigger(entity, scene, { interval: 1, autoStart: true });
      cube.onInit();

      // Should not trigger immediately
      let triggered = cube.checkAndConsumeTimer();
      expect(triggered).toBe(false);

      // Update for 1 second
      cube.onUpdate({ deltaTime: 1.0, gameTime: 1.0 });
      
      // Should trigger now
      triggered = cube.checkAndConsumeTimer();
      expect(triggered).toBe(true);

      // Should not trigger again immediately
      triggered = cube.checkAndConsumeTimer();
      expect(triggered).toBe(false);
    });

    it('OnGameStartTrigger should fire once with delay', () => {
      const cube = new OnGameStartTrigger(entity, scene, { delay: 0.5 });
      cube.onInit();

      // Update for 0.3 seconds (before delay)
      cube.onUpdate({ deltaTime: 0.3, gameTime: 0.3 });
      expect(cube.checkAndConsumeTrigger()).toBe(false);

      // Update for another 0.3 seconds (after delay)
      cube.onUpdate({ deltaTime: 0.3, gameTime: 0.6 });
      expect(cube.checkAndConsumeTrigger()).toBe(true);

      // Should not trigger again
      cube.onUpdate({ deltaTime: 1.0, gameTime: 1.6 });
      expect(cube.checkAndConsumeTrigger()).toBe(false);
    });
  });

  describe('Action Cubes', () => {
    it('LogAction should output message', () => {
      const cube = new LogAction(entity, scene, { message: 'Test Log' });
      const signal = { type: 'trigger' as const, sourceEntityId: entity.id, timestamp: 0 };
      
      const outputs = cube.onSignalReceived('trigger', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });

      expect(outputs).not.toBeNull();
      expect(outputs?.size).toBeGreaterThan(0);
    });

    it('SetVariableAction should store value', () => {
      const cube = new SetVariableAction(entity, scene, {
        variableName: 'testVar',
        value: '42',
        valueType: 'number',
      });
      
      const signal = { type: 'trigger' as const, sourceEntityId: entity.id, timestamp: 0 };
      cube.onSignalReceived('trigger', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });

      // Value should be stored in cube state
      const stored = cube.getState('var_testVar');
      expect(stored).toBe(42);
    });
  });

  describe('Condition Cubes', () => {
    it('CompareVariableCondition should route based on comparison', () => {
      const cube = new CompareVariableCondition(entity, scene, {
        variableName: 'score',
        operator: 'greaterThan',
        compareValue: '50',
      });

      // Set variable to 75
      cube.setState('var_score', 75);

      const signal = { type: 'trigger' as const, sourceEntityId: entity.id, timestamp: 0 };
      const outputs = cube.onSignalReceived('trigger', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });

      expect(outputs).not.toBeNull();
      expect(outputs?.has('true')).toBe(true);
      expect(outputs?.has('false')).toBe(false);
    });
  });

  describe('Data Cubes', () => {
    it('CounterData should increment and decrement', () => {
      const cube = new CounterData(entity, scene, { initialValue: 0, step: 1 });
      cube.onInit();

      const signal = { type: 'trigger' as const, sourceEntityId: entity.id, timestamp: 0 };

      // Increment
      let outputs = cube.onSignalReceived('increment', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });
      expect(cube.getState('count')).toBe(1);

      // Increment again
      outputs = cube.onSignalReceived('increment', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });
      expect(cube.getState('count')).toBe(2);

      // Decrement
      outputs = cube.onSignalReceived('decrement', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });
      expect(cube.getState('count')).toBe(1);

      // Reset
      outputs = cube.onSignalReceived('reset', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });
      expect(cube.getState('count')).toBe(0);
    });

    it('VariableData should store and retrieve values', () => {
      const cube = new VariableData(entity, scene, { initialValue: 'test' });
      cube.onInit();

      const signal = { type: 'trigger' as const, sourceEntityId: entity.id, timestamp: 0 };

      // Get initial value
      let outputs = cube.onSignalReceived('get', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });
      expect(outputs?.get('value')?.data).toBe('test');

      // Set new value
      const setSignal = { ...signal, data: 'newValue' };
      outputs = cube.onSignalReceived('set', setSignal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal: setSignal,
      });
      expect(cube.getState('value')).toBe('newValue');
    });
  });

  describe('Logic Gate Cubes', () => {
    it('ANDGate should output when both inputs are triggered', () => {
      const cube = new ANDGate(entity, scene, { resetAfterOutput: true });
      cube.onInit();

      const signal = { type: 'trigger' as const, sourceEntityId: entity.id, timestamp: 0 };

      // Trigger A
      let outputs = cube.onSignalReceived('inputA', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });
      expect(outputs).toBeNull(); // Not both inputs yet

      // Trigger B
      outputs = cube.onSignalReceived('inputB', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });
      expect(outputs).not.toBeNull(); // Both inputs now
      expect(outputs?.has('output')).toBe(true);
    });

    it('ORGate should output when any input is triggered', () => {
      const cube = new ORGate(entity, scene);

      const signal = { type: 'trigger' as const, sourceEntityId: entity.id, timestamp: 0 };

      // Trigger A
      let outputs = cube.onSignalReceived('inputA', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });
      expect(outputs).not.toBeNull();
      expect(outputs?.has('output')).toBe(true);

      // Trigger B also works
      outputs = cube.onSignalReceived('inputB', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });
      expect(outputs).not.toBeNull();
      expect(outputs?.has('output')).toBe(true);
    });

    it('NOTGate should invert input', () => {
      const cube = new NOTGate(entity, scene);
      cube.onInit();

      const signal = { type: 'trigger' as const, sourceEntityId: entity.id, timestamp: 0 };

      // Trigger input (sets flag)
      cube.onSignalReceived('input', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });

      // Check should not output (input was triggered)
      let outputs = cube.onSignalReceived('check', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });
      expect(outputs).toBeNull();

      // Check again (input was NOT triggered this time)
      outputs = cube.onSignalReceived('check', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });
      expect(outputs).not.toBeNull();
      expect(outputs?.has('output')).toBe(true);
    });

    it('DelayGate should delay signals', () => {
      const cube = new DelayGate(entity, scene, { delay: 1.0 });

      const signal = { type: 'trigger' as const, sourceEntityId: entity.id, timestamp: 0 };

      // Send input
      cube.onSignalReceived('input', signal, {
        deltaTime: 0.016,
        gameTime: 0,
        signal,
      });

      // Should not output immediately
      expect(cube.checkAndConsumeOutput()).toBeNull();

      // Update for 0.5 seconds
      cube.onUpdate({ deltaTime: 0.5, gameTime: 0.5 });
      expect(cube.checkAndConsumeOutput()).toBeNull();

      // Update for another 0.6 seconds (total 1.1)
      cube.onUpdate({ deltaTime: 0.6, gameTime: 1.1 });
      expect(cube.checkAndConsumeOutput()).not.toBeNull();
    });
  });
});

