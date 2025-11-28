/**
 * Economy Cubes - Logic cubes for currency/economy operations
 * Used for Tycoon/Simulator games
 */

import { LogicCube } from './LogicCube.js';
import type { LogicCubeMetadata, LogicSignal, LogicExecutionContext } from './types.js';
import { Logger } from '@engine/core/utils';
import { CurrencyComponent } from '@engine/world/components/CurrencyComponent';
import { PLATFORM_CURRENCY, CurrencyEventNames } from '@engine/economy';
import type { BalanceChangedEvent } from '@engine/economy';
import { getLogicConnectionManager } from '../../connection/index.js';

/**
 * GetBalanceData - Gets the current balance of a currency
 */
export class GetBalanceData extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'getBalance',
      displayName: 'Get Balance',
      category: 'data',
      description: 'Gets the current balance of a currency from player wallet',
      icon: 'wallet',
      inputs: [
        {
          id: 'get',
          type: 'trigger',
          direction: 'input',
          label: 'Get',
          description: 'Trigger to get current balance',
        },
      ],
      outputs: [
        {
          id: 'balance',
          type: 'data',
          direction: 'output',
          label: 'Balance',
          description: 'Current balance value',
          dataType: 'number',
        },
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Complete',
          description: 'Fires after getting balance',
        },
      ],
      parameters: [
        {
          key: 'currency',
          label: 'Currency',
          type: 'string',
          defaultValue: PLATFORM_CURRENCY,
          description: 'Currency type to check (default: coin)',
        },
        {
          key: 'targetEntity',
          label: 'Target Entity',
          type: 'string',
          defaultValue: 'player',
          description: 'Entity ID with CurrencyComponent (use "player" for triggering player)',
        },
      ],
      color: [1, 0.8, 0.2], // Gold
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'get') return null;

    const currency = this.getConfig<string>('currency', PLATFORM_CURRENCY);
    const targetEntityId = this.getConfig<string>('targetEntity', 'player');

    // Find target entity
    const targetEntity = this.resolveTargetEntity(targetEntityId, context);
    if (!targetEntity) {
      Logger.warn(`GetBalanceData: Target entity not found: ${targetEntityId}`);
      return null;
    }

    const currencyComponent = targetEntity.getComponent(CurrencyComponent);
    if (!currencyComponent) {
      Logger.warn(`GetBalanceData: Entity ${targetEntityId} has no CurrencyComponent`);
      return null;
    }

    let balance = 0;
    try {
      balance = currencyComponent.getBalance(currency);
    } catch (error) {
      Logger.warn(`GetBalanceData: Failed to get balance - ${(error as Error).message}`);
      return null;
    }

    const outputs = new Map<string, LogicSignal>();
    outputs.set('balance', {
      type: 'data',
      data: balance,
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    outputs.set('output', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }

  private resolveTargetEntity(targetEntityId: string, context: LogicExecutionContext) {
    if (targetEntityId === 'player' && context.triggeringPlayer) {
      return context.triggeringPlayer;
    }
    if (targetEntityId === 'self') {
      return this.entity;
    }
    // Try to find entity by ID in scene
    return this.scene.findEntityById(targetEntityId);
  }
}

/**
 * AddCurrencyAction - Adds currency to a wallet
 */
export class AddCurrencyAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'addCurrency',
      displayName: 'Add Currency',
      category: 'action',
      description: 'Adds currency to player wallet',
      icon: 'plus-circle',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
        {
          id: 'amount',
          type: 'data',
          direction: 'input',
          label: 'Amount',
          description: 'Amount to add (optional, uses parameter if not connected)',
          dataType: 'number',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Complete',
          description: 'Fires after currency is added',
        },
        {
          id: 'newBalance',
          type: 'data',
          direction: 'output',
          label: 'New Balance',
          description: 'Balance after adding',
          dataType: 'number',
        },
      ],
      parameters: [
        {
          key: 'amount',
          label: 'Amount',
          type: 'number',
          defaultValue: 100,
          min: 0,
          description: 'Amount of currency to add',
        },
        {
          key: 'currency',
          label: 'Currency',
          type: 'string',
          defaultValue: PLATFORM_CURRENCY,
          description: 'Currency type (default: coin)',
        },
        {
          key: 'targetEntity',
          label: 'Target Entity',
          type: 'string',
          defaultValue: 'player',
          description: 'Entity ID with CurrencyComponent',
        },
      ],
      color: [0.2, 0.8, 0.4], // Green
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    // Get amount from input signal or parameter
    let amount = this.getConfig<number>('amount', 100);
    if (signal.data !== undefined && typeof signal.data === 'number') {
      amount = signal.data;
    }

    const currency = this.getConfig<string>('currency', PLATFORM_CURRENCY);
    const targetEntityId = this.getConfig<string>('targetEntity', 'player');

    const targetEntity = this.resolveTargetEntity(targetEntityId, context);
    if (!targetEntity) {
      Logger.warn(`AddCurrencyAction: Target entity not found: ${targetEntityId}`);
      return null;
    }

    const currencyComponent = targetEntity.getComponent(CurrencyComponent);
    if (!currencyComponent) {
      Logger.warn(`AddCurrencyAction: Entity ${targetEntityId} has no CurrencyComponent`);
      return null;
    }

    try {
      currencyComponent.deposit({ currency, amount }, 'LogicCube: AddCurrency');
      const newBalance = currencyComponent.getBalance(currency);

      Logger.debug(`AddCurrencyAction: Added ${amount} ${currency} to ${targetEntityId}`);

      const outputs = new Map<string, LogicSignal>();
      outputs.set('output', {
        type: 'trigger',
        sourceEntityId: this.entity.id,
        timestamp: signal.timestamp,
      });
      outputs.set('newBalance', {
        type: 'data',
        data: newBalance,
        sourceEntityId: this.entity.id,
        timestamp: signal.timestamp,
      });
      return outputs;
    } catch (error) {
      Logger.error(`AddCurrencyAction: Failed - ${(error as Error).message}`);
      return null;
    }
  }

  private resolveTargetEntity(targetEntityId: string, context: LogicExecutionContext) {
    if (targetEntityId === 'player' && context.triggeringPlayer) {
      return context.triggeringPlayer;
    }
    if (targetEntityId === 'self') {
      return this.entity;
    }
    return this.scene.findEntityById(targetEntityId);
  }
}

/**
 * SubtractCurrencyAction - Subtracts currency from a wallet
 */
export class SubtractCurrencyAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'subtractCurrency',
      displayName: 'Subtract Currency',
      category: 'action',
      description: 'Subtracts currency from player wallet (fails if insufficient balance)',
      icon: 'minus-circle',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
        {
          id: 'amount',
          type: 'data',
          direction: 'input',
          label: 'Amount',
          description: 'Amount to subtract (optional)',
          dataType: 'number',
        },
      ],
      outputs: [
        {
          id: 'success',
          type: 'trigger',
          direction: 'output',
          label: 'Success',
          description: 'Fires if currency was subtracted successfully',
        },
        {
          id: 'failure',
          type: 'trigger',
          direction: 'output',
          label: 'Failure',
          description: 'Fires if insufficient balance',
        },
        {
          id: 'newBalance',
          type: 'data',
          direction: 'output',
          label: 'New Balance',
          description: 'Balance after subtracting',
          dataType: 'number',
        },
      ],
      parameters: [
        {
          key: 'amount',
          label: 'Amount',
          type: 'number',
          defaultValue: 100,
          min: 0,
          description: 'Amount of currency to subtract',
        },
        {
          key: 'currency',
          label: 'Currency',
          type: 'string',
          defaultValue: PLATFORM_CURRENCY,
          description: 'Currency type (default: coin)',
        },
        {
          key: 'targetEntity',
          label: 'Target Entity',
          type: 'string',
          defaultValue: 'player',
          description: 'Entity ID with CurrencyComponent',
        },
      ],
      color: [0.9, 0.3, 0.3], // Red
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    let amount = this.getConfig<number>('amount', 100);
    if (signal.data !== undefined && typeof signal.data === 'number') {
      amount = signal.data;
    }

    const currency = this.getConfig<string>('currency', PLATFORM_CURRENCY);
    const targetEntityId = this.getConfig<string>('targetEntity', 'player');

    const targetEntity = this.resolveTargetEntity(targetEntityId, context);
    if (!targetEntity) {
      Logger.warn(`SubtractCurrencyAction: Target entity not found: ${targetEntityId}`);
      return this.createFailureOutput(signal);
    }

    const currencyComponent = targetEntity.getComponent(CurrencyComponent);
    if (!currencyComponent) {
      Logger.warn(`SubtractCurrencyAction: Entity ${targetEntityId} has no CurrencyComponent`);
      return this.createFailureOutput(signal);
    }

    // Check balance first
    if (!currencyComponent.hasBalance(currency, amount)) {
      Logger.debug(`SubtractCurrencyAction: Insufficient balance for ${amount} ${currency}`);
      return this.createFailureOutput(signal);
    }

    try {
      currencyComponent.withdraw({ currency, amount }, 'LogicCube: SubtractCurrency');
      const newBalance = currencyComponent.getBalance(currency);

      Logger.debug(`SubtractCurrencyAction: Subtracted ${amount} ${currency} from ${targetEntityId}`);

      const outputs = new Map<string, LogicSignal>();
      outputs.set('success', {
        type: 'trigger',
        sourceEntityId: this.entity.id,
        timestamp: signal.timestamp,
      });
      outputs.set('newBalance', {
        type: 'data',
        data: newBalance,
        sourceEntityId: this.entity.id,
        timestamp: signal.timestamp,
      });
      return outputs;
    } catch (error) {
      Logger.error(`SubtractCurrencyAction: Failed - ${(error as Error).message}`);
      return this.createFailureOutput(signal);
    }
  }

  private createFailureOutput(signal: LogicSignal): Map<string, LogicSignal> {
    const outputs = new Map<string, LogicSignal>();
    outputs.set('failure', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }

  private resolveTargetEntity(targetEntityId: string, context: LogicExecutionContext) {
    if (targetEntityId === 'player' && context.triggeringPlayer) {
      return context.triggeringPlayer;
    }
    if (targetEntityId === 'self') {
      return this.entity;
    }
    return this.scene.findEntityById(targetEntityId);
  }
}

/**
 * HasCurrencyCondition - Checks if wallet has enough currency
 */
export class HasCurrencyCondition extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'hasCurrency',
      displayName: 'Has Currency?',
      category: 'condition',
      description: 'Checks if player has at least the specified amount of currency',
      icon: 'help-circle',
      inputs: [
        {
          id: 'check',
          type: 'trigger',
          direction: 'input',
          label: 'Check',
          description: 'Trigger to check balance',
        },
        {
          id: 'amount',
          type: 'data',
          direction: 'input',
          label: 'Amount',
          description: 'Amount to check (optional)',
          dataType: 'number',
        },
      ],
      outputs: [
        {
          id: 'true',
          type: 'trigger',
          direction: 'output',
          label: 'True',
          description: 'Fires if player has enough currency',
        },
        {
          id: 'false',
          type: 'trigger',
          direction: 'output',
          label: 'False',
          description: 'Fires if player does not have enough currency',
        },
        {
          id: 'balance',
          type: 'data',
          direction: 'output',
          label: 'Current Balance',
          description: 'Current balance value',
          dataType: 'number',
        },
      ],
      parameters: [
        {
          key: 'amount',
          label: 'Required Amount',
          type: 'number',
          defaultValue: 100,
          min: 0,
          description: 'Minimum amount required',
        },
        {
          key: 'currency',
          label: 'Currency',
          type: 'string',
          defaultValue: PLATFORM_CURRENCY,
          description: 'Currency type to check',
        },
        {
          key: 'targetEntity',
          label: 'Target Entity',
          type: 'string',
          defaultValue: 'player',
          description: 'Entity ID with CurrencyComponent',
        },
      ],
      color: [0.5, 0.5, 1], // Blue-purple
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'check') return null;

    let requiredAmount = this.getConfig<number>('amount', 100);
    if (signal.data !== undefined && typeof signal.data === 'number') {
      requiredAmount = signal.data;
    }

    const currency = this.getConfig<string>('currency', PLATFORM_CURRENCY);
    const targetEntityId = this.getConfig<string>('targetEntity', 'player');

    const targetEntity = this.resolveTargetEntity(targetEntityId, context);
    if (!targetEntity) {
      Logger.warn(`HasCurrencyCondition: Target entity not found: ${targetEntityId}`);
      return this.createOutput(false, 0, signal);
    }

    const currencyComponent = targetEntity.getComponent(CurrencyComponent);
    if (!currencyComponent) {
      Logger.warn(`HasCurrencyCondition: Entity ${targetEntityId} has no CurrencyComponent`);
      return this.createOutput(false, 0, signal);
    }

    let balance = 0;
    try {
      balance = currencyComponent.getBalance(currency);
    } catch {
      return this.createOutput(false, 0, signal);
    }

    const hasEnough = balance >= requiredAmount;
    return this.createOutput(hasEnough, balance, signal);
  }

  private createOutput(
    result: boolean,
    balance: number,
    signal: LogicSignal
  ): Map<string, LogicSignal> {
    const outputs = new Map<string, LogicSignal>();
    outputs.set(result ? 'true' : 'false', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    outputs.set('balance', {
      type: 'data',
      data: balance,
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }

  private resolveTargetEntity(targetEntityId: string, context: LogicExecutionContext) {
    if (targetEntityId === 'player' && context.triggeringPlayer) {
      return context.triggeringPlayer;
    }
    if (targetEntityId === 'self') {
      return this.entity;
    }
    return this.scene.findEntityById(targetEntityId);
  }
}

/**
 * OnBalanceChangedTrigger - Triggers when currency balance changes
 */
export class OnBalanceChangedTrigger extends LogicCube {
  private balanceHandler: ((event: BalanceChangedEvent | undefined) => void) | null = null;

  getMetadata(): LogicCubeMetadata {
    return {
      type: 'onBalanceChanged',
      displayName: 'On Balance Changed',
      category: 'trigger',
      description: 'Triggers when currency balance changes',
      icon: 'trending-up',
      inputs: [],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'On Change',
          description: 'Fires when balance changes',
        },
        {
          id: 'newBalance',
          type: 'data',
          direction: 'output',
          label: 'New Balance',
          description: 'New balance value',
          dataType: 'number',
        },
        {
          id: 'previousBalance',
          type: 'data',
          direction: 'output',
          label: 'Previous Balance',
          description: 'Previous balance value',
          dataType: 'number',
        },
        {
          id: 'delta',
          type: 'data',
          direction: 'output',
          label: 'Change Amount',
          description: 'Amount changed (positive or negative)',
          dataType: 'number',
        },
      ],
      parameters: [
        {
          key: 'currency',
          label: 'Currency',
          type: 'string',
          defaultValue: PLATFORM_CURRENCY,
          description: 'Currency type to watch',
        },
        {
          key: 'walletId',
          label: 'Wallet ID',
          type: 'string',
          defaultValue: '',
          description: 'Specific wallet ID to watch (empty = all wallets)',
        },
      ],
      color: [1, 0.6, 0.2], // Orange
    };
  }

  override onInit(): void {
    super.onInit();
    this.setupHandler();
  }

  override onDestroy(): void {
    super.onDestroy();
    this.removeHandler();
  }

  private setupHandler(): void {
    if (this.balanceHandler) return;

    const currency = this.getConfig<string>('currency', PLATFORM_CURRENCY);
    const walletId = this.getConfig<string>('walletId', '');

    this.balanceHandler = (event: BalanceChangedEvent | undefined) => {
      if (!event) return;
      // Filter by currency
      if (event.currency !== currency) return;

      // Filter by wallet ID if specified
      if (walletId && event.walletId !== walletId) return;

      if (!this.enabled || this.isOnCooldown()) return;

      const connectionManager = getLogicConnectionManager(this.scene);
      if (!connectionManager) return;

      const delta = event.newBalance - event.previousBalance;

      // Emit signals
      const triggerSignal: LogicSignal = {
        type: 'trigger',
        sourceEntityId: this.entity.id,
        timestamp: Date.now(),
      };

      // Emit to all connected outputs
      const connections = connectionManager.getConnectionsFromPort(this.entity.id, 'output');
      for (const conn of connections) {
        this.scene.events.publish({
          type: 'logic:signal',
          payload: {
            targetEntityId: conn.targetEntityId,
            targetPort: conn.targetPort,
            signal: triggerSignal,
          },
          sender: this.entity,
        });
      }

      // Emit data signals
      this.emitDataSignal(connectionManager, 'newBalance', event.newBalance);
      this.emitDataSignal(connectionManager, 'previousBalance', event.previousBalance);
      this.emitDataSignal(connectionManager, 'delta', delta);
    };

    this.scene.events.on(CurrencyEventNames.BALANCE_CHANGED, this.balanceHandler);
  }

  private emitDataSignal(
    connectionManager: ReturnType<typeof getLogicConnectionManager>,
    portId: string,
    data: number
  ): void {
    if (!connectionManager) return;

    const signal: LogicSignal = {
      type: 'data',
      data,
      sourceEntityId: this.entity.id,
      timestamp: Date.now(),
    };

    const connections = connectionManager.getConnectionsFromPort(this.entity.id, portId);
    for (const conn of connections) {
      this.scene.events.publish({
        type: 'logic:signal',
        payload: {
          targetEntityId: conn.targetEntityId,
          targetPort: conn.targetPort,
          signal,
        },
        sender: this.entity,
      });
    }
  }

  private removeHandler(): void {
    if (this.balanceHandler) {
      this.scene.events.off(CurrencyEventNames.BALANCE_CHANGED, this.balanceHandler);
      this.balanceHandler = null;
    }
  }

  onSignalReceived(
    _portId: string,
    _signal: LogicSignal,
    _context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    // This cube doesn't receive signals, it generates them on balance change
    return null;
  }
}

/**
 * PurchaseAction - Combined action to check balance, subtract currency, and optionally add item
 */
export class PurchaseAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'purchase',
      displayName: 'Purchase',
      category: 'action',
      description: 'Attempts to purchase: checks balance, subtracts currency, emits success/failure',
      icon: 'shopping-cart',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Buy',
          description: 'Attempt purchase',
        },
        {
          id: 'price',
          type: 'data',
          direction: 'input',
          label: 'Price',
          description: 'Purchase price (optional)',
          dataType: 'number',
        },
      ],
      outputs: [
        {
          id: 'success',
          type: 'trigger',
          direction: 'output',
          label: 'Success',
          description: 'Fires if purchase succeeded',
        },
        {
          id: 'failure',
          type: 'trigger',
          direction: 'output',
          label: 'Failure',
          description: 'Fires if purchase failed (insufficient funds)',
        },
        {
          id: 'newBalance',
          type: 'data',
          direction: 'output',
          label: 'New Balance',
          description: 'Balance after purchase',
          dataType: 'number',
        },
        {
          id: 'itemId',
          type: 'data',
          direction: 'output',
          label: 'Item ID',
          description: 'ID of purchased item (from parameter)',
          dataType: 'string',
        },
      ],
      parameters: [
        {
          key: 'price',
          label: 'Price',
          type: 'number',
          defaultValue: 100,
          min: 0,
          description: 'Cost of the purchase',
        },
        {
          key: 'currency',
          label: 'Currency',
          type: 'string',
          defaultValue: PLATFORM_CURRENCY,
          description: 'Currency type to use',
        },
        {
          key: 'itemId',
          label: 'Item ID',
          type: 'string',
          defaultValue: '',
          description: 'Optional item ID to output on success',
        },
        {
          key: 'targetEntity',
          label: 'Target Entity',
          type: 'string',
          defaultValue: 'player',
          description: 'Entity with CurrencyComponent',
        },
      ],
      color: [0.9, 0.5, 0.8], // Pink
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    let price = this.getConfig<number>('price', 100);
    if (signal.data !== undefined && typeof signal.data === 'number') {
      price = signal.data;
    }

    const currency = this.getConfig<string>('currency', PLATFORM_CURRENCY);
    const itemId = this.getConfig<string>('itemId', '');
    const targetEntityId = this.getConfig<string>('targetEntity', 'player');

    const targetEntity = this.resolveTargetEntity(targetEntityId, context);
    if (!targetEntity) {
      Logger.warn(`PurchaseAction: Target entity not found: ${targetEntityId}`);
      return this.createFailureOutput(signal);
    }

    const currencyComponent = targetEntity.getComponent(CurrencyComponent);
    if (!currencyComponent) {
      Logger.warn(`PurchaseAction: Entity ${targetEntityId} has no CurrencyComponent`);
      return this.createFailureOutput(signal);
    }

    // Check balance
    if (!currencyComponent.hasBalance(currency, price)) {
      Logger.debug(`PurchaseAction: Insufficient balance for ${price} ${currency}`);
      return this.createFailureOutput(signal);
    }

    try {
      currencyComponent.withdraw({ currency, amount: price }, `LogicCube: Purchase ${itemId || 'item'}`);
      const newBalance = currencyComponent.getBalance(currency);

      Logger.debug(`PurchaseAction: Purchased ${itemId || 'item'} for ${price} ${currency}`);

      const outputs = new Map<string, LogicSignal>();
      outputs.set('success', {
        type: 'trigger',
        sourceEntityId: this.entity.id,
        timestamp: signal.timestamp,
      });
      outputs.set('newBalance', {
        type: 'data',
        data: newBalance,
        sourceEntityId: this.entity.id,
        timestamp: signal.timestamp,
      });
      if (itemId) {
        outputs.set('itemId', {
          type: 'data',
          data: itemId,
          sourceEntityId: this.entity.id,
          timestamp: signal.timestamp,
        });
      }
      return outputs;
    } catch (error) {
      Logger.error(`PurchaseAction: Failed - ${(error as Error).message}`);
      return this.createFailureOutput(signal);
    }
  }

  private createFailureOutput(signal: LogicSignal): Map<string, LogicSignal> {
    const outputs = new Map<string, LogicSignal>();
    outputs.set('failure', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }

  private resolveTargetEntity(targetEntityId: string, context: LogicExecutionContext) {
    if (targetEntityId === 'player' && context.triggeringPlayer) {
      return context.triggeringPlayer;
    }
    if (targetEntityId === 'self') {
      return this.entity;
    }
    return this.scene.findEntityById(targetEntityId);
  }
}

