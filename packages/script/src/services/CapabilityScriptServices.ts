/**
 * Capability-Wrapped Script Services
 * 
 * Wrappers for ScriptServices facades that enforce capability checks.
 * Each wrapper validates capability tokens before allowing access to underlying services.
 */

import type {
  PhysicsScriptFacade,
  AnimationScriptFacade,
  RenderingScriptFacade,
} from '../behavior/Behavior.js';
import type { CapabilityToken } from '../security/CapabilityToken.js';
import type { CapabilityManager } from '../security/CapabilityToken.js';
import { SCRIPT_CAPABILITIES } from '../security/CapabilityTypes.js';

/**
 * Error thrown when capability is not granted
 */
export class CapabilityError extends Error {
  constructor(capability: string) {
    super(`Capability '${capability}' not granted`);
    this.name = 'CapabilityError';
  }
}

/**
 * Wrapper for PhysicsScriptFacade with capability checking
 */
export class CapabilityPhysicsFacade implements PhysicsScriptFacade {
  private readonly token: CapabilityToken;
  private readonly manager: CapabilityManager;
  private readonly facade: PhysicsScriptFacade;

  constructor(token: CapabilityToken, manager: CapabilityManager, facade: PhysicsScriptFacade) {
    this.token = token;
    this.manager = manager;
    this.facade = facade;
  }

  get world(): PhysicsScriptFacade['world'] {
    if (!this.manager.hasCapability(this.token, SCRIPT_CAPABILITIES.PHYSICS)) {
      throw new CapabilityError(SCRIPT_CAPABILITIES.PHYSICS);
    }
    return this.facade.world;
  }
}

/**
 * Wrapper for AnimationScriptFacade with capability checking
 */
export class CapabilityAnimationFacade implements AnimationScriptFacade {
  private readonly token: CapabilityToken;
  private readonly manager: CapabilityManager;
  private readonly facade: AnimationScriptFacade;

  constructor(token: CapabilityToken, manager: CapabilityManager, facade: AnimationScriptFacade) {
    this.token = token;
    this.manager = manager;
    this.facade = facade;
  }

  get system(): AnimationScriptFacade['system'] {
    if (!this.manager.hasCapability(this.token, SCRIPT_CAPABILITIES.ANIMATION)) {
      throw new CapabilityError(SCRIPT_CAPABILITIES.ANIMATION);
    }
    return this.facade.system;
  }
}

/**
 * Wrapper for RenderingScriptFacade with capability checking
 */
export class CapabilityRenderingFacade implements RenderingScriptFacade {
  private readonly token: CapabilityToken;
  private readonly manager: CapabilityManager;
  private readonly facade: RenderingScriptFacade;

  constructor(token: CapabilityToken, manager: CapabilityManager, facade: RenderingScriptFacade) {
    this.token = token;
    this.manager = manager;
    this.facade = facade;
  }

  get renderer(): RenderingScriptFacade['renderer'] {
    if (!this.manager.hasCapability(this.token, SCRIPT_CAPABILITIES.RENDERING)) {
      throw new CapabilityError(SCRIPT_CAPABILITIES.RENDERING);
    }
    return this.facade.renderer;
  }
}

