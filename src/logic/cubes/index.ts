/**
 * Logic Cubes - Export all cube types and register them
 */

import { LogicCubeRegistry } from '../LogicCubeSystem';

// Import all cube types
import {
  OnClickTrigger,
  OnTimerTrigger,
  OnGameStartTrigger,
  OnPlayerEnterTrigger,
  OnPlayerLeaveTrigger,
} from './TriggerCubes';

import {
  SendMessageAction,
  SetVariableAction,
  SpawnEntityAction,
  DestroyEntityAction,
  LogAction,
} from './ActionCubes';

import {
  CompareVariableCondition,
  IsPlayerNearCondition,
  CheckDistanceCondition,
} from './ConditionCubes';

import { VariableData, CounterData, TimerData } from './DataCubes';

import { ANDGate, ORGate, NOTGate, DelayGate } from './LogicGateCubes';

// Export all cube types
export {
  // Triggers
  OnClickTrigger,
  OnTimerTrigger,
  OnGameStartTrigger,
  OnPlayerEnterTrigger,
  OnPlayerLeaveTrigger,
  // Actions
  SendMessageAction,
  SetVariableAction,
  SpawnEntityAction,
  DestroyEntityAction,
  LogAction,
  // Conditions
  CompareVariableCondition,
  IsPlayerNearCondition,
  CheckDistanceCondition,
  // Data
  VariableData,
  CounterData,
  TimerData,
  // Logic Gates
  ANDGate,
  ORGate,
  NOTGate,
  DelayGate,
};

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
}

