/**
 * Logic Cubes Demo - Examples showcasing the visual scripting system
 * 
 * This file demonstrates various logic cube patterns and use cases.
 * To use: Import and call the demo functions in your application.
 */

import { Scene } from '../src/scene/Scene';
import { Entity } from '../src/scene/Entity';
import { LogicCubeComponent } from '../src/scene/components/LogicCubeComponent';
import { LogicCubeSystem } from '../src/logic/LogicCubeSystem';
import { LogicCubeLibrary } from '@engine/editor-utils';
import { registerBuiltInLogicCubes } from '../src/logic/cubes';

/**
 * Example 1: Simple Click Counter
 * 
 * Creates a logic chain that counts button clicks:
 * OnClick → Counter → SendMessage
 */
export function createClickCounterDemo(scene: Scene): {
  triggerCube: Entity;
  counterCube: Entity;
  actionCube: Entity;
} {
  // Register cube types
  registerBuiltInLogicCubes();
  LogicCubeLibrary.initialize();

  // Create logic cube system
  const logicSystem = new LogicCubeSystem(scene);

  // 1. Create trigger cube (OnClick)
  const triggerEntry = LogicCubeLibrary.get('onClickTrigger');
  if (!triggerEntry) throw new Error('OnClickTrigger not found');
  
  const triggerCube = triggerEntry.createEntity(scene);
  triggerCube.name = 'Click Button';
  triggerCube.transform.position = [0, 1, 0];
  scene.addEntity(triggerCube);

  // 2. Create counter cube
  const counterEntry = LogicCubeLibrary.get('counterData');
  if (!counterEntry) throw new Error('CounterData not found');
  
  const counterCube = counterEntry.createEntity(scene);
  counterCube.name = 'Click Counter';
  counterCube.transform.position = [2, 1, 0];
  
  const counterComponent = counterCube.getComponent(LogicCubeComponent);
  counterComponent?.setConfigValue('initialValue', 0);
  counterComponent?.setConfigValue('step', 1);
  
  scene.addEntity(counterCube);

  // 3. Create action cube (SendMessage)
  const actionEntry = LogicCubeLibrary.get('sendMessageAction');
  if (!actionEntry) throw new Error('SendMessageAction not found');
  
  const actionCube = actionEntry.createEntity(scene);
  actionCube.name = 'Send Event';
  actionCube.transform.position = [4, 1, 0];
  
  const actionComponent = actionCube.getComponent(LogicCubeComponent);
  actionComponent?.setConfigValue('message', 'CounterUpdated');
  actionComponent?.setConfigValue('data', '{"count": 0}');
  
  scene.addEntity(actionCube);

  // 4. Create connections
  const connectionManager = logicSystem.getConnectionManager();
  
  // Connect trigger → counter
  connectionManager.addConnection(
    triggerCube.id,
    'output',
    counterCube.id,
    'increment'
  );
  
  // Connect counter → action
  connectionManager.addConnection(
    counterCube.id,
    'onChange',
    actionCube.id,
    'trigger'
  );

  console.log('Click Counter Demo created!');
  console.log('- Click the trigger cube to increment counter');
  console.log('- Counter sends event on each change');

  return { triggerCube, counterCube, actionCube };
}

/**
 * Example 2: Timer System
 * 
 * Creates a repeating timer that triggers an action:
 * OnTimer → Log → SendMessage
 */
export function createTimerDemo(scene: Scene): {
  timerCube: Entity;
  logCube: Entity;
} {
  registerBuiltInLogicCubes();
  LogicCubeLibrary.initialize();

  const logicSystem = new LogicCubeSystem(scene);

  // 1. Create timer cube
  const timerEntry = LogicCubeLibrary.get('onTimerTrigger');
  if (!timerEntry) throw new Error('OnTimerTrigger not found');
  
  const timerCube = timerEntry.createEntity(scene);
  timerCube.name = 'Repeating Timer';
  timerCube.transform.position = [0, 1, 0];
  
  const timerComponent = timerCube.getComponent(LogicCubeComponent);
  timerComponent?.setConfigValue('interval', 2); // 2 seconds
  timerComponent?.setConfigValue('autoStart', true);
  
  scene.addEntity(timerCube);

  // 2. Create log action
  const logEntry = LogicCubeLibrary.get('logAction');
  if (!logEntry) throw new Error('LogAction not found');
  
  const logCube = logEntry.createEntity(scene);
  logCube.name = 'Timer Log';
  logCube.transform.position = [2, 1, 0];
  
  const logComponent = logCube.getComponent(LogicCubeComponent);
  logComponent?.setConfigValue('message', 'Timer fired!');
  
  scene.addEntity(logCube);

  // 3. Create connection
  const connectionManager = logicSystem.getConnectionManager();
  connectionManager.addConnection(
    timerCube.id,
    'output',
    logCube.id,
    'trigger'
  );

  console.log('Timer Demo created!');
  console.log('- Timer fires every 2 seconds');
  console.log('- Check console for log messages');

  return { timerCube, logCube };
}

/**
 * Example 3: Conditional Logic
 * 
 * Creates a system that only triggers when a condition is met:
 * OnClick → CompareVariable → [True/False] → Different Actions
 */
export function createConditionalDemo(scene: Scene): {
  triggerCube: Entity;
  conditionCube: Entity;
  trueActionCube: Entity;
  falseActionCube: Entity;
} {
  registerBuiltInLogicCubes();
  LogicCubeLibrary.initialize();

  const logicSystem = new LogicCubeSystem(scene);

  // Set up a test variable
  const variables = logicSystem.getVariableStorage();
  variables.set('score', 75);

  // 1. Create trigger
  const triggerEntry = LogicCubeLibrary.get('onClickTrigger');
  if (!triggerEntry) throw new Error('OnClickTrigger not found');
  
  const triggerCube = triggerEntry.createEntity(scene);
  triggerCube.name = 'Check Button';
  triggerCube.transform.position = [0, 1, 0];
  scene.addEntity(triggerCube);

  // 2. Create condition cube (compare score > 50)
  const conditionEntry = LogicCubeLibrary.get('compareVariableCondition');
  if (!conditionEntry) throw new Error('CompareVariableCondition not found');
  
  const conditionCube = conditionEntry.createEntity(scene);
  conditionCube.name = 'Score Check';
  conditionCube.transform.position = [2, 1, 0];
  
  const conditionComponent = conditionCube.getComponent(LogicCubeComponent);
  conditionComponent?.setConfigValue('variableName', 'score');
  conditionComponent?.setConfigValue('operator', 'greaterThan');
  conditionComponent?.setConfigValue('compareValue', '50');
  
  scene.addEntity(conditionCube);

  // 3. Create "True" action
  const trueEntry = LogicCubeLibrary.get('logAction');
  if (!trueEntry) throw new Error('LogAction not found');
  
  const trueActionCube = trueEntry.createEntity(scene);
  trueActionCube.name = 'Success Log';
  trueActionCube.transform.position = [4, 2, 0];
  
  const trueComponent = trueActionCube.getComponent(LogicCubeComponent);
  trueComponent?.setConfigValue('message', 'Score is high!');
  
  scene.addEntity(trueActionCube);

  // 4. Create "False" action
  const falseEntry = LogicCubeLibrary.get('logAction');
  if (!falseEntry) throw new Error('LogAction not found');
  
  const falseActionCube = falseEntry.createEntity(scene);
  falseActionCube.name = 'Fail Log';
  falseActionCube.transform.position = [4, 0, 0];
  
  const falseComponent = falseActionCube.getComponent(LogicCubeComponent);
  falseComponent?.setConfigValue('message', 'Score is low!');
  
  scene.addEntity(falseActionCube);

  // 5. Create connections
  const connectionManager = logicSystem.getConnectionManager();
  
  // Trigger → Condition
  connectionManager.addConnection(
    triggerCube.id,
    'output',
    conditionCube.id,
    'trigger'
  );
  
  // Condition (true) → True action
  connectionManager.addConnection(
    conditionCube.id,
    'true',
    trueActionCube.id,
    'trigger'
  );
  
  // Condition (false) → False action
  connectionManager.addConnection(
    conditionCube.id,
    'false',
    falseActionCube.id,
    'trigger'
  );

  console.log('Conditional Demo created!');
  console.log('- Click to check if score > 50');
  console.log('- Current score:', variables.get('score'));

  return { triggerCube, conditionCube, trueActionCube, falseActionCube };
}

/**
 * Example 4: AND Gate Logic
 * 
 * Creates a system that requires two buttons to be pressed:
 * Button1 → \
 *            → AND Gate → Action
 * Button2 → /
 */
export function createANDGateDemo(scene: Scene): {
  button1: Entity;
  button2: Entity;
  andGate: Entity;
  action: Entity;
} {
  registerBuiltInLogicCubes();
  LogicCubeLibrary.initialize();

  const logicSystem = new LogicCubeSystem(scene);

  // 1. Create first button
  const button1Entry = LogicCubeLibrary.get('onClickTrigger');
  if (!button1Entry) throw new Error('OnClickTrigger not found');
  
  const button1 = button1Entry.createEntity(scene);
  button1.name = 'Button A';
  button1.transform.position = [0, 2, 0];
  scene.addEntity(button1);

  // 2. Create second button
  const button2Entry = LogicCubeLibrary.get('onClickTrigger');
  if (!button2Entry) throw new Error('OnClickTrigger not found');
  
  const button2 = button2Entry.createEntity(scene);
  button2.name = 'Button B';
  button2.transform.position = [0, 0, 0];
  scene.addEntity(button2);

  // 3. Create AND gate
  const andEntry = LogicCubeLibrary.get('andGate');
  if (!andEntry) throw new Error('ANDGate not found');
  
  const andGate = andEntry.createEntity(scene);
  andGate.name = 'AND Gate';
  andGate.transform.position = [2, 1, 0];
  
  const andComponent = andGate.getComponent(LogicCubeComponent);
  andComponent?.setConfigValue('resetAfterOutput', true);
  
  scene.addEntity(andGate);

  // 4. Create action
  const actionEntry = LogicCubeLibrary.get('logAction');
  if (!actionEntry) throw new Error('LogAction not found');
  
  const action = actionEntry.createEntity(scene);
  action.name = 'Both Pressed';
  action.transform.position = [4, 1, 0];
  
  const actionComponent = action.getComponent(LogicCubeComponent);
  actionComponent?.setConfigValue('message', 'Both buttons pressed!');
  
  scene.addEntity(action);

  // 5. Create connections
  const connectionManager = logicSystem.getConnectionManager();
  
  connectionManager.addConnection(button1.id, 'output', andGate.id, 'inputA');
  connectionManager.addConnection(button2.id, 'output', andGate.id, 'inputB');
  connectionManager.addConnection(andGate.id, 'output', action.id, 'trigger');

  console.log('AND Gate Demo created!');
  console.log('- Press both buttons to trigger action');
  console.log('- Only fires when both are pressed');

  return { button1, button2, andGate, action };
}

/**
 * Example 5: Delayed Action
 * 
 * Creates a system with a delay between trigger and action:
 * OnClick → Delay Gate → Action
 */
export function createDelayDemo(scene: Scene): {
  trigger: Entity;
  delay: Entity;
  action: Entity;
} {
  registerBuiltInLogicCubes();
  LogicCubeLibrary.initialize();

  const logicSystem = new LogicCubeSystem(scene);

  // 1. Create trigger
  const triggerEntry = LogicCubeLibrary.get('onClickTrigger');
  if (!triggerEntry) throw new Error('OnClickTrigger not found');
  
  const trigger = triggerEntry.createEntity(scene);
  trigger.name = 'Trigger';
  trigger.transform.position = [0, 1, 0];
  scene.addEntity(trigger);

  // 2. Create delay gate
  const delayEntry = LogicCubeLibrary.get('delayGate');
  if (!delayEntry) throw new Error('DelayGate not found');
  
  const delay = delayEntry.createEntity(scene);
  delay.name = 'Delay 3s';
  delay.transform.position = [2, 1, 0];
  
  const delayComponent = delay.getComponent(LogicCubeComponent);
  delayComponent?.setConfigValue('delay', 3); // 3 second delay
  
  scene.addEntity(delay);

  // 3. Create action
  const actionEntry = LogicCubeLibrary.get('logAction');
  if (!actionEntry) throw new Error('LogAction not found');
  
  const action = actionEntry.createEntity(scene);
  action.name = 'Delayed Action';
  action.transform.position = [4, 1, 0];
  
  const actionComponent = action.getComponent(LogicCubeComponent);
  actionComponent?.setConfigValue('message', 'Delayed action executed!');
  
  scene.addEntity(action);

  // 4. Create connections
  const connectionManager = logicSystem.getConnectionManager();
  
  connectionManager.addConnection(trigger.id, 'output', delay.id, 'input');
  connectionManager.addConnection(delay.id, 'output', action.id, 'trigger');

  console.log('Delay Demo created!');
  console.log('- Click trigger');
  console.log('- Action fires 3 seconds later');

  return { trigger, delay, action };
}

/**
 * Example 6: Complete Game Loop
 * 
 * Combines multiple systems into a simple game:
 * - OnGameStart initializes the game
 * - Timer spawns enemies
 * - Counter tracks score
 * - Condition checks win state
 */
export function createGameLoopDemo(scene: Scene): {
  gameStart: Entity;
  spawner: Entity;
  scoreCounter: Entity;
  winCheck: Entity;
} {
  registerBuiltInLogicCubes();
  LogicCubeLibrary.initialize();

  const logicSystem = new LogicCubeSystem(scene);

  // Initialize variables
  const variables = logicSystem.getVariableStorage();
  variables.set('score', 0);
  variables.set('targetScore', 10);

  // 1. Game start trigger
  const startEntry = LogicCubeLibrary.get('onGameStartTrigger');
  if (!startEntry) throw new Error('OnGameStartTrigger not found');
  
  const gameStart = startEntry.createEntity(scene);
  gameStart.name = 'Game Start';
  gameStart.transform.position = [0, 1, 0];
  
  const startComponent = gameStart.getComponent(LogicCubeComponent);
  startComponent?.setConfigValue('delay', 0);
  
  scene.addEntity(gameStart);

  // 2. Enemy spawner (timer)
  const spawnerEntry = LogicCubeLibrary.get('onTimerTrigger');
  if (!spawnerEntry) throw new Error('OnTimerTrigger not found');
  
  const spawner = spawnerEntry.createEntity(scene);
  spawner.name = 'Enemy Spawner';
  spawner.transform.position = [2, 1, 0];
  
  const spawnerComponent = spawner.getComponent(LogicCubeComponent);
  spawnerComponent?.setConfigValue('interval', 5);
  spawnerComponent?.setConfigValue('autoStart', true);
  
  scene.addEntity(spawner);

  // 3. Score counter
  const counterEntry = LogicCubeLibrary.get('counterData');
  if (!counterEntry) throw new Error('CounterData not found');
  
  const scoreCounter = counterEntry.createEntity(scene);
  scoreCounter.name = 'Score';
  scoreCounter.transform.position = [4, 1, 0];
  
  const counterComponent = scoreCounter.getComponent(LogicCubeComponent);
  counterComponent?.setConfigValue('initialValue', 0);
  counterComponent?.setConfigValue('step', 1);
  
  scene.addEntity(scoreCounter);

  // 4. Win condition check
  const winEntry = LogicCubeLibrary.get('compareVariableCondition');
  if (!winEntry) throw new Error('CompareVariableCondition not found');
  
  const winCheck = winEntry.createEntity(scene);
  winCheck.name = 'Win Check';
  winCheck.transform.position = [6, 1, 0];
  
  const winComponent = winCheck.getComponent(LogicCubeComponent);
  winComponent?.setConfigValue('variableName', 'score');
  winComponent?.setConfigValue('operator', 'greaterOrEqual');
  winComponent?.setConfigValue('compareValue', '10');
  
  scene.addEntity(winCheck);

  console.log('Game Loop Demo created!');
  console.log('- Game starts automatically');
  console.log('- Enemies spawn every 5 seconds');
  console.log('- Score tracks progress');
  console.log('- Win when score >= 10');

  return { gameStart, spawner, scoreCounter, winCheck };
}

/**
 * Utility: Create all demos in a scene
 */
export function createAllDemos(scene: Scene): void {
  console.log('Creating all logic cube demos...\n');

  // Spread demos across the scene
  const demos = [
    { name: 'Click Counter', fn: createClickCounterDemo, offset: [0, 0, 0] },
    { name: 'Timer System', fn: createTimerDemo, offset: [10, 0, 0] },
    { name: 'Conditional Logic', fn: createConditionalDemo, offset: [20, 0, 0] },
    { name: 'AND Gate', fn: createANDGateDemo, offset: [30, 0, 0] },
    { name: 'Delay Action', fn: createDelayDemo, offset: [40, 0, 0] },
    { name: 'Game Loop', fn: createGameLoopDemo, offset: [50, 0, 0] },
  ];

  for (const demo of demos) {
    console.log(`\nCreating ${demo.name} Demo...`);
    const entities = demo.fn(scene);
    
    // Offset entity positions
    for (const entity of Object.values(entities)) {
      if (entity && entity.transform) {
        entity.transform.position[0] += demo.offset[0];
        entity.transform.position[1] += demo.offset[1];
        entity.transform.position[2] += demo.offset[2];
      }
    }
  }

  console.log('\nAll demos created successfully!');
}

