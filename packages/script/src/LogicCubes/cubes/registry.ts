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
}
