import { LogicCubeRegistry } from '../LogicCubeSystem.js';

// Import specific cubes for registration
import {
  OnClickTrigger,
  OnTimerTrigger,
  OnGameStartTrigger,
  OnPlayerEnterTrigger,
  OnPlayerLeaveTrigger,
  OnInteractTrigger,
} from './TriggerCubes.js';

import {
  SendMessageAction,
  SetVariableAction,
  SpawnEntityAction,
  DestroyEntityAction,
  LogAction,
  TeleportPlayerAction,
  KillPlayerAction,
  RespawnPlayerAction,
  ApplyImpulseAction,
} from './ActionCubes.js';

import {
  UIButtonClickTrigger,
  UIShowElementAction,
  UISetTextAction,
  UISetImageAction,
  UISetValueAction,
  UIEnableElementAction,
} from './UICubes.js';

import {
  GetBalanceData,
  AddCurrencyAction,
  SubtractCurrencyAction,
  HasCurrencyCondition,
  OnBalanceChangedTrigger,
  PurchaseAction,
} from './EconomyCubes.js';

import {
  AddItemAction,
  RemoveItemAction,
  HasItemCondition,
  GetItemCountData,
  OnItemAddedTrigger,
  OnItemRemovedTrigger,
} from './InventoryCubes.js';

import {
  CompareVariableCondition,
  IsPlayerNearCondition,
  CheckDistanceCondition,
} from './ConditionCubes.js';

import { VariableData, CounterData, TimerData } from './DataCubes.js';

import { ANDGate, ORGate, NOTGate, DelayGate } from './LogicGateCubes.js';

/**
 * Registers all built-in logic cube types
 */
export function registerBuiltInLogicCubes(): void {
  // Triggers
  LogicCubeRegistry.register('onClickTrigger', OnClickTrigger);
  LogicCubeRegistry.register('onTimerTrigger', OnTimerTrigger);
  LogicCubeRegistry.register('onGameStartTrigger', OnGameStartTrigger);
  LogicCubeRegistry.register('onPlayerEnterTrigger', OnPlayerEnterTrigger);
  LogicCubeRegistry.register('onPlayerLeaveTrigger', OnPlayerLeaveTrigger);
  LogicCubeRegistry.register('onInteractTrigger', OnInteractTrigger);

  // Actions
  LogicCubeRegistry.register('sendMessageAction', SendMessageAction);
  LogicCubeRegistry.register('setVariableAction', SetVariableAction);
  LogicCubeRegistry.register('spawnEntityAction', SpawnEntityAction);
  LogicCubeRegistry.register('destroyEntityAction', DestroyEntityAction);
  LogicCubeRegistry.register('logAction', LogAction);

  // Platformer/Obby Actions
  LogicCubeRegistry.register('teleportPlayerAction', TeleportPlayerAction);
  LogicCubeRegistry.register('killPlayerAction', KillPlayerAction);
  LogicCubeRegistry.register('respawnPlayerAction', RespawnPlayerAction);
  LogicCubeRegistry.register('applyImpulseAction', ApplyImpulseAction);

  // Conditions
  LogicCubeRegistry.register('compareVariableCondition', CompareVariableCondition);
  LogicCubeRegistry.register('isPlayerNearCondition', IsPlayerNearCondition);
  LogicCubeRegistry.register('checkDistanceCondition', CheckDistanceCondition);

  // Data
  LogicCubeRegistry.register('variableData', VariableData);
  LogicCubeRegistry.register('counterData', CounterData);
  LogicCubeRegistry.register('timerData', TimerData);

  // Logic Gates
  LogicCubeRegistry.register('andGate', ANDGate);
  LogicCubeRegistry.register('orGate', ORGate);
  LogicCubeRegistry.register('notGate', NOTGate);
  LogicCubeRegistry.register('delayGate', DelayGate);

  // UI Cubes
  LogicCubeRegistry.register('uiButtonClick', UIButtonClickTrigger);
  LogicCubeRegistry.register('uiShowElement', UIShowElementAction);
  LogicCubeRegistry.register('uiSetText', UISetTextAction);
  LogicCubeRegistry.register('uiSetImage', UISetImageAction);
  LogicCubeRegistry.register('uiSetValue', UISetValueAction);
  LogicCubeRegistry.register('uiEnableElement', UIEnableElementAction);

  // Economy Cubes (Tycoon/Simulator)
  LogicCubeRegistry.register('getBalance', GetBalanceData);
  LogicCubeRegistry.register('addCurrency', AddCurrencyAction);
  LogicCubeRegistry.register('subtractCurrency', SubtractCurrencyAction);
  LogicCubeRegistry.register('hasCurrency', HasCurrencyCondition);
  LogicCubeRegistry.register('onBalanceChanged', OnBalanceChangedTrigger);
  LogicCubeRegistry.register('purchase', PurchaseAction);

  // Inventory Cubes (Tycoon/Simulator)
  LogicCubeRegistry.register('addItem', AddItemAction);
  LogicCubeRegistry.register('removeItem', RemoveItemAction);
  LogicCubeRegistry.register('hasItem', HasItemCondition);
  LogicCubeRegistry.register('getItemCount', GetItemCountData);
  LogicCubeRegistry.register('onItemAdded', OnItemAddedTrigger);
  LogicCubeRegistry.register('onItemRemoved', OnItemRemovedTrigger);
}
