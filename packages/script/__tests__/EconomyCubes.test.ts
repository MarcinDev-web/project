/**
 * Tests for Economy Logic Cubes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Scene, Entity, CurrencyComponent } from '@engine/world';
import { CurrencyManager } from '@engine/economy';
import {
  GetBalanceData,
  AddCurrencyAction,
  SubtractCurrencyAction,
  HasCurrencyCondition,
  PurchaseAction,
} from '../src/LogicCubes/cubes/EconomyCubes.js';
import type { LogicSignal, LogicExecutionContext } from '../src/LogicCubes/cubes/types.js';

describe('Economy Cubes', () => {
  let scene: Scene;
  let entity: Entity;
  let playerEntity: Entity;
  let currencyManager: CurrencyManager;

  const createSignal = (data?: unknown): LogicSignal => ({
    type: 'trigger',
    sourceEntityId: entity.id,
    timestamp: Date.now(),
    data,
  });

  const createContext = (signal: LogicSignal): LogicExecutionContext => ({
    deltaTime: 0.016,
    gameTime: 0,
    signal,
    triggeringPlayer: playerEntity,
  });

  beforeEach(() => {
    scene = new Scene('Test Scene');
    entity = new Entity('LogicCubeEntity');
    playerEntity = new Entity('Player');

    // Setup currency system - CurrencyManager constructor takes maxHistorySize, not EventBus
    currencyManager = new CurrencyManager(100);
    const currencyComponent = new CurrencyComponent('player_wallet');
    currencyComponent.setManager(currencyManager);
    playerEntity.addComponent(currencyComponent);

    // Give player some initial currency
    currencyComponent.deposit({ currency: 'coin', amount: 1000 });

    scene.addEntity(entity);
    scene.addEntity(playerEntity);
  });

  afterEach(() => {
    currencyManager.dispose();
  });

  describe('GetBalanceData', () => {
    it('should have correct metadata', () => {
      const cube = new GetBalanceData(entity, scene);
      const metadata = cube.getMetadata();

      expect(metadata.type).toBe('getBalance');
      expect(metadata.category).toBe('data');
      expect(metadata.outputs.some((o) => o.id === 'balance')).toBe(true);
    });

    it('should return current balance', () => {
      const cube = new GetBalanceData(entity, scene, {
        currency: 'coin',
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('get', signal, context);

      expect(outputs).not.toBeNull();
      expect(outputs?.get('balance')?.data).toBe(1000);
    });

    it('should return 0 for non-existent currency', () => {
      const cube = new GetBalanceData(entity, scene, {
        currency: 'gems',
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('get', signal, context);

      expect(outputs?.get('balance')?.data).toBe(0);
    });
  });

  describe('AddCurrencyAction', () => {
    it('should add currency to wallet', () => {
      const cube = new AddCurrencyAction(entity, scene, {
        amount: 500,
        currency: 'coin',
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      expect(outputs).not.toBeNull();
      expect(outputs?.has('output')).toBe(true);
      expect(outputs?.get('newBalance')?.data).toBe(1500);

      // Verify balance actually changed
      const currencyComp = playerEntity.getComponent(CurrencyComponent);
      expect(currencyComp?.getBalance('coin')).toBe(1500);
    });

    it('should use amount from signal data if provided', () => {
      const cube = new AddCurrencyAction(entity, scene, {
        amount: 100,
        currency: 'coin',
        targetEntity: 'player',
      });

      const signal = createSignal(250); // Override amount
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      expect(outputs?.get('newBalance')?.data).toBe(1250);
    });
  });

  describe('SubtractCurrencyAction', () => {
    it('should subtract currency from wallet', () => {
      const cube = new SubtractCurrencyAction(entity, scene, {
        amount: 300,
        currency: 'coin',
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      expect(outputs).not.toBeNull();
      expect(outputs?.has('success')).toBe(true);
      expect(outputs?.get('newBalance')?.data).toBe(700);
    });

    it('should fail if insufficient balance', () => {
      const cube = new SubtractCurrencyAction(entity, scene, {
        amount: 2000,
        currency: 'coin',
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      expect(outputs).not.toBeNull();
      expect(outputs?.has('failure')).toBe(true);
      expect(outputs?.has('success')).toBe(false);

      // Balance should not change
      const currencyComp = playerEntity.getComponent(CurrencyComponent);
      expect(currencyComp?.getBalance('coin')).toBe(1000);
    });
  });

  describe('HasCurrencyCondition', () => {
    it('should return true when balance is sufficient', () => {
      const cube = new HasCurrencyCondition(entity, scene, {
        amount: 500,
        currency: 'coin',
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('check', signal, context);

      expect(outputs).not.toBeNull();
      expect(outputs?.has('true')).toBe(true);
      expect(outputs?.has('false')).toBe(false);
      expect(outputs?.get('balance')?.data).toBe(1000);
    });

    it('should return false when balance is insufficient', () => {
      const cube = new HasCurrencyCondition(entity, scene, {
        amount: 1500,
        currency: 'coin',
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('check', signal, context);

      expect(outputs).not.toBeNull();
      expect(outputs?.has('true')).toBe(false);
      expect(outputs?.has('false')).toBe(true);
    });

    it('should accept amount from signal data', () => {
      const cube = new HasCurrencyCondition(entity, scene, {
        amount: 100,
        currency: 'coin',
        targetEntity: 'player',
      });

      // Check for 1500 via signal data
      const signal = createSignal(1500);
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('check', signal, context);

      expect(outputs?.has('false')).toBe(true);
    });
  });

  describe('PurchaseAction', () => {
    it('should successfully purchase when balance is sufficient', () => {
      const cube = new PurchaseAction(entity, scene, {
        price: 250,
        currency: 'coin',
        itemId: 'speed_upgrade',
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      expect(outputs).not.toBeNull();
      expect(outputs?.has('success')).toBe(true);
      expect(outputs?.has('failure')).toBe(false);
      expect(outputs?.get('newBalance')?.data).toBe(750);
      expect(outputs?.get('itemId')?.data).toBe('speed_upgrade');
    });

    it('should fail purchase when balance is insufficient', () => {
      const cube = new PurchaseAction(entity, scene, {
        price: 2000,
        currency: 'coin',
        itemId: 'expensive_item',
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      expect(outputs).not.toBeNull();
      expect(outputs?.has('failure')).toBe(true);
      expect(outputs?.has('success')).toBe(false);

      // Balance should not change
      const currencyComp = playerEntity.getComponent(CurrencyComponent);
      expect(currencyComp?.getBalance('coin')).toBe(1000);
    });

    it('should use price from signal data', () => {
      const cube = new PurchaseAction(entity, scene, {
        price: 100,
        currency: 'coin',
        targetEntity: 'player',
      });

      // Dynamic price from signal
      const signal = createSignal(400);
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      expect(outputs?.get('newBalance')?.data).toBe(600);
    });
  });

  describe('target entity resolution', () => {
    it('should resolve "self" to cube entity', () => {
      // Add currency component to the cube entity
      const selfCurrencyComp = new CurrencyComponent('self_wallet');
      selfCurrencyComp.setManager(currencyManager);
      entity.addComponent(selfCurrencyComp);
      selfCurrencyComp.deposit({ currency: 'coin', amount: 500 });

      const cube = new GetBalanceData(entity, scene, {
        currency: 'coin',
        targetEntity: 'self',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('get', signal, context);

      expect(outputs?.get('balance')?.data).toBe(500);
    });

    it('should return null for non-existent target entity', () => {
      const cube = new GetBalanceData(entity, scene, {
        currency: 'coin',
        targetEntity: 'non_existent_entity',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('get', signal, context);

      expect(outputs).toBeNull();
    });
  });
});

