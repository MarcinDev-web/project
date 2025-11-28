/**
 * Action Cubes - Perform actions when triggered
 */

import { LogicCube } from './LogicCube.js';
import type { LogicCubeMetadata, LogicSignal, LogicExecutionContext } from './types.js';
import { Logger } from '@engine/core/utils';
import { CharacterController, HealthComponent } from '@engine/world';
import type { Vec3 } from '@engine/core/math';

/**
 * SendMessage Action - Sends a message via event bus
 */
export class SendMessageAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'sendMessageAction',
      displayName: 'Send Message',
      category: 'action',
      description: 'Sends a message to the event bus',
      icon: 'message',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Complete',
          description: 'Fires after message is sent',
        },
      ],
      parameters: [
        {
          key: 'message',
          label: 'Message',
          type: 'string',
          defaultValue: 'CustomEvent',
          description: 'Event name to send',
        },
        {
          key: 'data',
          label: 'Data (JSON)',
          type: 'string',
          defaultValue: '{}',
          description: 'JSON data to send with event',
        },
      ],
      color: [0.8, 0.4, 1], // Purple
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    _context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const message = this.getConfig<string>('message', 'CustomEvent');
    const dataStr = this.getConfig<string>('data', '{}');

    try {
      const data: unknown = JSON.parse(dataStr);
      this.scene.events.publish({ type: message, payload: data, sender: this.entity });
      Logger.info(`Logic cube sent message: ${message}`, data);
    } catch (error) {
      Logger.error(`Failed to send message from logic cube:`, error as Error);
      return null;
    }

    // Pass signal through
    const outputs = new Map<string, LogicSignal>();
    outputs.set('output', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }
}

/**
 * SetVariable Action - Sets a variable value
 */
export class SetVariableAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'setVariableAction',
      displayName: 'Set Variable',
      category: 'action',
      description: 'Sets a variable to a value',
      icon: 'box',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
        {
          id: 'value',
          type: 'data',
          direction: 'input',
          label: 'Value',
          description: 'Value to set (optional)',
          dataType: 'any',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Complete',
          description: 'Fires after variable is set',
        },
      ],
      parameters: [
        {
          key: 'variableName',
          label: 'Variable Name',
          type: 'string',
          defaultValue: 'myVariable',
          description: 'Name of the variable',
        },
        {
          key: 'value',
          label: 'Value',
          type: 'string',
          defaultValue: '0',
          description: 'Default value to set',
        },
        {
          key: 'valueType',
          label: 'Type',
          type: 'select',
          defaultValue: 'number',
          options: [
            { label: 'Number', value: 'number' },
            { label: 'String', value: 'string' },
            { label: 'Boolean', value: 'boolean' },
          ],
          description: 'Value type',
        },
      ],
      color: [0.2, 0.8, 1], // Cyan
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    _context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    // Get variable storage from scene (we'll need to access it through the system)
    // For now, log the action
    const variableName = this.getConfig<string>('variableName', 'myVariable');
    const valueStr = this.getConfig<string>('value', '0');
    const valueType = this.getConfig<string>('valueType', 'number');

    let value: string | number | boolean;
    try {
      if (valueType === 'number') {
        value = parseFloat(valueStr);
      } else if (valueType === 'boolean') {
        value = valueStr.toLowerCase() === 'true';
      } else {
        value = valueStr;
      }
    } catch (error) {
      Logger.error(`Failed to parse variable value:`, error as Error);
      return null;
    }

    // Store in entity state for now (will be connected to VariableStorage later)
    this.setState(`var_${variableName}`, value);
    Logger.info(`Logic cube set variable: ${variableName} = ${value}`);

    // Pass signal through
    const outputs = new Map<string, LogicSignal>();
    outputs.set('output', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }
}

/**
 * SpawnEntity Action - Spawns an entity
 */
export class SpawnEntityAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'spawnEntityAction',
      displayName: 'Spawn Entity',
      category: 'action',
      description: 'Spawns a new entity',
      icon: 'plus',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Complete',
          description: 'Fires after spawn',
        },
      ],
      parameters: [
        {
          key: 'prefabName',
          label: 'Prefab Name',
          type: 'string',
          defaultValue: 'Cube',
          description: 'Name of entity to spawn',
        },
        {
          key: 'offsetX',
          label: 'Offset X',
          type: 'number',
          defaultValue: 0,
          description: 'X position offset',
        },
        {
          key: 'offsetY',
          label: 'Offset Y',
          type: 'number',
          defaultValue: 2,
          description: 'Y position offset',
        },
        {
          key: 'offsetZ',
          label: 'Offset Z',
          type: 'number',
          defaultValue: 0,
          description: 'Z position offset',
        },
      ],
      color: [0.2, 1, 0.5], // Green-cyan
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    _context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const prefabName = this.getConfig<string>('prefabName', 'Cube');
    const offsetX = this.getConfig<number>('offsetX', 0);
    const offsetY = this.getConfig<number>('offsetY', 2);
    const offsetZ = this.getConfig<number>('offsetZ', 0);

    Logger.info(
      `Logic cube spawn entity: ${prefabName} at offset (${offsetX}, ${offsetY}, ${offsetZ})`
    );

    // Actual spawning logic would go here
    // For now, just log the action

    // Pass signal through
    const outputs = new Map<string, LogicSignal>();
    outputs.set('output', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }
}

/**
 * DestroyEntity Action - Destroys an entity
 */
export class DestroyEntityAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'destroyEntityAction',
      displayName: 'Destroy Entity',
      category: 'action',
      description: 'Destroys this or another entity',
      icon: 'trash',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
      ],
      outputs: [],
      parameters: [
        {
          key: 'target',
          label: 'Target',
          type: 'select',
          defaultValue: 'self',
          options: [
            { label: 'Self', value: 'self' },
            { label: 'Other', value: 'other' },
          ],
          description: 'What to destroy',
        },
      ],
      color: [1, 0.3, 0.3], // Red
    };
  }

  onSignalReceived(portId: string): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const target = this.getConfig<string>('target', 'self');

    if (target === 'self') {
      Logger.info(`Logic cube destroying self: ${this.entity.id}`);
      // Schedule destruction (don't destroy immediately during signal processing)
      this.setState('scheduledForDestruction', true);
    }

    return null;
  }
}

/**
 * Log Action - Logs a message to console (useful for debugging)
 */
export class LogAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'logAction',
      displayName: 'Log Message',
      category: 'action',
      description: 'Logs a message to console',
      icon: 'terminal',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Complete',
          description: 'Fires after logging',
        },
      ],
      parameters: [
        {
          key: 'message',
          label: 'Message',
          type: 'string',
          defaultValue: 'Hello World',
          description: 'Message to log',
        },
      ],
      color: [0.5, 0.5, 0.5], // Gray
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    _context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const message = this.getConfig<string>('message', 'Hello World');
    Logger.info(`[Logic Cube Log] ${message}`);

    // Pass signal through
    const outputs = new Map<string, LogicSignal>();
    outputs.set('output', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }
}

/**
 * TeleportPlayer Action - Teleports the player to a position or entity
 */
export class TeleportPlayerAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'teleportPlayerAction',
      displayName: 'Teleport Player',
      category: 'action',
      description: 'Teleports the player to a position or entity',
      icon: 'arrow-right',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Complete',
          description: 'Fires after teleport',
        },
      ],
      parameters: [
        {
          key: 'mode',
          label: 'Mode',
          type: 'select',
          defaultValue: 'position',
          options: [
            { label: 'Position', value: 'position' },
            { label: 'Entity', value: 'entity' },
            { label: 'This Entity', value: 'self' },
          ],
          description: 'Teleport mode',
        },
        {
          key: 'targetX',
          label: 'Target X',
          type: 'number',
          defaultValue: 0,
          description: 'X coordinate (position mode)',
        },
        {
          key: 'targetY',
          label: 'Target Y',
          type: 'number',
          defaultValue: 5,
          description: 'Y coordinate (position mode)',
        },
        {
          key: 'targetZ',
          label: 'Target Z',
          type: 'number',
          defaultValue: 0,
          description: 'Z coordinate (position mode)',
        },
        {
          key: 'targetEntityName',
          label: 'Target Entity Name',
          type: 'string',
          defaultValue: '',
          description: 'Name of entity to teleport to (entity mode)',
        },
        {
          key: 'offsetY',
          label: 'Y Offset',
          type: 'number',
          defaultValue: 0,
          description: 'Additional Y offset from target',
        },
        {
          key: 'preserveVelocity',
          label: 'Preserve Velocity',
          type: 'boolean',
          defaultValue: false,
          description: 'Keep player velocity after teleport',
        },
      ],
      color: [0.2, 0.6, 1], // Blue
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    _context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const playerDetection = this.getPlayerDetection();
    if (!playerDetection) {
      Logger.warn('[TeleportPlayerAction] No player detection available');
      return null;
    }

    const playerEntity = playerDetection.getPlayerEntity();
    if (!playerEntity) {
      Logger.warn('[TeleportPlayerAction] No player entity found');
      return null;
    }

    const controller = playerEntity.getComponent(CharacterController);
    if (!controller) {
      Logger.warn('[TeleportPlayerAction] Player has no CharacterController');
      return null;
    }

    const mode = this.getConfig<string>('mode', 'position');
    const offsetY = this.getConfig<number>('offsetY', 0);
    const preserveVelocity = this.getConfig<boolean>('preserveVelocity', false);

    let targetPosition: Vec3;

    if (mode === 'self') {
      // Teleport to this entity's position
      const pos = this.entity.transform.position;
      targetPosition = [pos[0], pos[1] + offsetY, pos[2]];
    } else if (mode === 'entity') {
      // Teleport to named entity
      const targetName = this.getConfig<string>('targetEntityName', '');
      if (!targetName) {
        Logger.warn('[TeleportPlayerAction] No target entity name specified');
        return null;
      }
      const targets = this.scene.findEntitiesByName(targetName);
      if (targets.length === 0) {
        Logger.warn(`[TeleportPlayerAction] Entity "${targetName}" not found`);
        return null;
      }
      const targetEntity = targets[0]!;
      const pos = targetEntity.transform.position;
      targetPosition = [pos[0], pos[1] + offsetY, pos[2]];
    } else {
      // Teleport to position
      const x = this.getConfig<number>('targetX', 0);
      const y = this.getConfig<number>('targetY', 5);
      const z = this.getConfig<number>('targetZ', 0);
      targetPosition = [x, y + offsetY, z];
    }

    // Save velocity if needed
    const savedVelocity = preserveVelocity ? [...controller.velocity] as Vec3 : null;

    // Teleport
    controller.teleport(targetPosition);

    // Restore velocity if needed
    if (savedVelocity) {
      controller.velocity = savedVelocity;
    }

    Logger.info(`[TeleportPlayerAction] Teleported player to (${targetPosition[0]}, ${targetPosition[1]}, ${targetPosition[2]})`);

    // Emit event
    this.scene.events.publish({
      type: 'player:teleport',
      payload: { position: targetPosition },
      sender: this.entity,
    });

    // Pass signal through
    const outputs = new Map<string, LogicSignal>();
    outputs.set('output', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }
}

/**
 * KillPlayer Action - Kills the player (triggering respawn flow)
 */
export class KillPlayerAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'killPlayerAction',
      displayName: 'Kill Player',
      category: 'action',
      description: 'Kills the player, triggering respawn',
      icon: 'skull',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Complete',
          description: 'Fires after kill',
        },
      ],
      parameters: [
        {
          key: 'instantKill',
          label: 'Instant Kill',
          type: 'boolean',
          defaultValue: true,
          description: 'Kill instantly (ignore health)',
        },
        {
          key: 'damage',
          label: 'Damage',
          type: 'number',
          defaultValue: 100,
          description: 'Damage to deal (if not instant kill)',
          min: 0,
          max: 10000,
        },
      ],
      color: [1, 0.2, 0.2], // Red
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    _context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const playerDetection = this.getPlayerDetection();
    if (!playerDetection) {
      Logger.warn('[KillPlayerAction] No player detection available');
      return null;
    }

    const playerEntity = playerDetection.getPlayerEntity();
    if (!playerEntity) {
      Logger.warn('[KillPlayerAction] No player entity found');
      return null;
    }

    const instantKill = this.getConfig<boolean>('instantKill', true);
    const damage = this.getConfig<number>('damage', 100);

    const health = playerEntity.getComponent(HealthComponent);

    if (health) {
      if (instantKill) {
        health.currentHealth = 0;
        Logger.info('[KillPlayerAction] Instantly killed player');
      } else {
        health.takeDamage(damage);
        Logger.info(`[KillPlayerAction] Dealt ${damage} damage to player`);
      }
    } else {
      // No health component - emit kill event directly
      Logger.info('[KillPlayerAction] Player has no health, emitting kill event');
    }

    // Emit kill event
    this.scene.events.publish({
      type: 'player:killed',
      payload: {
        entityId: playerEntity.id,
        killerEntityId: this.entity.id,
        instantKill,
      },
      sender: this.entity,
    });

    // Pass signal through
    const outputs = new Map<string, LogicSignal>();
    outputs.set('output', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }
}

/**
 * RespawnPlayer Action - Respawns the player at checkpoint or default spawn
 */
export class RespawnPlayerAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'respawnPlayerAction',
      displayName: 'Respawn Player',
      category: 'action',
      description: 'Respawns the player at checkpoint or spawn point',
      icon: 'rotate-ccw',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Complete',
          description: 'Fires after respawn',
        },
      ],
      parameters: [
        {
          key: 'useCheckpoint',
          label: 'Use Checkpoint',
          type: 'boolean',
          defaultValue: true,
          description: 'Respawn at last checkpoint (if available)',
        },
        {
          key: 'customX',
          label: 'Custom X',
          type: 'number',
          defaultValue: 0,
          description: 'Custom respawn X (if not using checkpoint)',
        },
        {
          key: 'customY',
          label: 'Custom Y',
          type: 'number',
          defaultValue: 5,
          description: 'Custom respawn Y (if not using checkpoint)',
        },
        {
          key: 'customZ',
          label: 'Custom Z',
          type: 'number',
          defaultValue: 0,
          description: 'Custom respawn Z (if not using checkpoint)',
        },
        {
          key: 'resetHealth',
          label: 'Reset Health',
          type: 'boolean',
          defaultValue: true,
          description: 'Reset health to max on respawn',
        },
        {
          key: 'resetVelocity',
          label: 'Reset Velocity',
          type: 'boolean',
          defaultValue: true,
          description: 'Reset velocity on respawn',
        },
      ],
      color: [0.2, 1, 0.6], // Green
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    _context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const playerDetection = this.getPlayerDetection();
    if (!playerDetection) {
      Logger.warn('[RespawnPlayerAction] No player detection available');
      return null;
    }

    const playerEntity = playerDetection.getPlayerEntity();
    if (!playerEntity) {
      Logger.warn('[RespawnPlayerAction] No player entity found');
      return null;
    }

    const controller = playerEntity.getComponent(CharacterController);
    if (!controller) {
      Logger.warn('[RespawnPlayerAction] Player has no CharacterController');
      return null;
    }

    const useCheckpoint = this.getConfig<boolean>('useCheckpoint', true);
    const resetHealth = this.getConfig<boolean>('resetHealth', true);
    const resetVelocity = this.getConfig<boolean>('resetVelocity', true);

    let respawnPosition: Vec3;

    if (useCheckpoint) {
      // Try to use checkpoint - emit event requesting respawn position
      // The game can listen for this and call back with the position
      // For now, use custom position as fallback
      const x = this.getConfig<number>('customX', 0);
      const y = this.getConfig<number>('customY', 5);
      const z = this.getConfig<number>('customZ', 0);
      respawnPosition = [x, y, z];
    } else {
      const x = this.getConfig<number>('customX', 0);
      const y = this.getConfig<number>('customY', 5);
      const z = this.getConfig<number>('customZ', 0);
      respawnPosition = [x, y, z];
    }

    // Teleport player
    controller.teleport(respawnPosition);

    // Reset velocity if needed
    if (resetVelocity) {
      controller.velocity = [0, 0, 0];
    }

    // Reset health if needed
    if (resetHealth) {
      const health = playerEntity.getComponent(HealthComponent);
      if (health) {
        health.reset();
      }
    }

    Logger.info(`[RespawnPlayerAction] Respawned player at (${respawnPosition[0]}, ${respawnPosition[1]}, ${respawnPosition[2]})`);

    // Emit respawn event
    this.scene.events.publish({
      type: 'player:respawn',
      payload: {
        entityId: playerEntity.id,
        position: respawnPosition,
        useCheckpoint,
      },
      sender: this.entity,
    });

    // Pass signal through
    const outputs = new Map<string, LogicSignal>();
    outputs.set('output', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }
}

/**
 * ApplyImpulse Action - Applies a velocity impulse to the player
 */
export class ApplyImpulseAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'applyImpulseAction',
      displayName: 'Apply Impulse',
      category: 'action',
      description: 'Applies a velocity impulse to the player',
      icon: 'zap',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Complete',
          description: 'Fires after impulse applied',
        },
      ],
      parameters: [
        {
          key: 'forceX',
          label: 'Force X',
          type: 'number',
          defaultValue: 0,
          description: 'X component of impulse',
        },
        {
          key: 'forceY',
          label: 'Force Y',
          type: 'number',
          defaultValue: 10,
          description: 'Y component of impulse',
        },
        {
          key: 'forceZ',
          label: 'Force Z',
          type: 'number',
          defaultValue: 0,
          description: 'Z component of impulse',
        },
        {
          key: 'relative',
          label: 'Relative to Entity',
          type: 'boolean',
          defaultValue: false,
          description: 'Apply force relative to this entity rotation',
        },
        {
          key: 'replaceVelocity',
          label: 'Replace Velocity',
          type: 'boolean',
          defaultValue: false,
          description: 'Replace velocity instead of adding to it',
        },
      ],
      color: [1, 0.8, 0.2], // Yellow
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    _context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const playerDetection = this.getPlayerDetection();
    if (!playerDetection) {
      Logger.warn('[ApplyImpulseAction] No player detection available');
      return null;
    }

    const playerEntity = playerDetection.getPlayerEntity();
    if (!playerEntity) {
      Logger.warn('[ApplyImpulseAction] No player entity found');
      return null;
    }

    const controller = playerEntity.getComponent(CharacterController);
    if (!controller) {
      Logger.warn('[ApplyImpulseAction] Player has no CharacterController');
      return null;
    }

    let forceX = this.getConfig<number>('forceX', 0);
    let forceY = this.getConfig<number>('forceY', 10);
    let forceZ = this.getConfig<number>('forceZ', 0);
    const relative = this.getConfig<boolean>('relative', false);
    const replaceVelocity = this.getConfig<boolean>('replaceVelocity', false);

    // Transform force to world space if relative
    if (relative) {
      const forward = this.entity.transform.getForward();
      const up = this.entity.transform.getUp();
      
      // Calculate right vector from forward and up (cross product: up × forward)
      const right: Vec3 = [
        up[1] * forward[2] - up[2] * forward[1],
        up[2] * forward[0] - up[0] * forward[2],
        up[0] * forward[1] - up[1] * forward[0],
      ];

      // Calculate world-space force
      const worldForce: Vec3 = [
        forward[0] * forceZ + right[0] * forceX + up[0] * forceY,
        forward[1] * forceZ + right[1] * forceX + up[1] * forceY,
        forward[2] * forceZ + right[2] * forceX + up[2] * forceY,
      ];

      forceX = worldForce[0];
      forceY = worldForce[1];
      forceZ = worldForce[2];
    }

    // Apply impulse
    if (replaceVelocity) {
      controller.velocity = [forceX, forceY, forceZ];
    } else {
      controller.velocity = [
        controller.velocity[0] + forceX,
        controller.velocity[1] + forceY,
        controller.velocity[2] + forceZ,
      ];
    }

    Logger.info(`[ApplyImpulseAction] Applied impulse (${forceX}, ${forceY}, ${forceZ})`);

    // Emit event
    this.scene.events.publish({
      type: 'player:impulse',
      payload: { force: [forceX, forceY, forceZ] },
      sender: this.entity,
    });

    // Pass signal through
    const outputs = new Map<string, LogicSignal>();
    outputs.set('output', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }
}
