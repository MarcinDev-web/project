/**
 * Script runtime types (placeholders).
 * Full implementation will be in @engine/script.
 */

// ScriptRuntime interface (used by Scene)
// Full implementation in @engine/script
export interface ScriptRuntime {
  scheduler?: unknown;
  behaviors?: unknown;
  contextBuilder?: unknown;
  physicsWorld?: unknown;
  animationSystem?: unknown;
  renderer?: unknown;
  [key: string]: unknown;
}

