# Play Mode State Machine Implementation

## Overview

This document describes the play mode state machine architecture implemented to replace the simple Edit/Play toggle. The new system provides proper separation of authoring from runtime, manages cameras and input cleanly, and validates before play.

## Architecture

### State Flow

```
EDIT → PREFLIGHT → LOADING → PLAY_INTRO → PLAYING ↔ PAUSED → RETURN → EDIT
```

### Core Components

#### 1. PlayModeStateMachine (`src/editor/core/PlayModeStateMachine.ts`)

The state machine coordinator that manages transitions and state lifecycle.

**Key Features:**
- State registration and initialization
- Transition validation
- Context sharing between states
- Error handling and recovery

**State Types:**
- `EDIT` - Default editor mode
- `PREFLIGHT` - Validation before play
- `LOADING` - Build runtime world
- `PLAY_INTRO` - Camera/input handoff
- `PLAYING` - Active gameplay
- `PAUSED` - Game paused
- `RETURN` - Teardown and restore

#### 2. PlayManifest (`src/editor/core/PlayManifest.ts`)

The "single source of truth" built during preflight and consumed during runtime.

**Contains:**
- Player start configuration (position, rotation, controller mode)
- Simulation settings (tick rate, gravity, RNG seed)
- Rendering configuration (shadows, LOD, post-processing)
- Input bindings (movement, actions, camera sensitivity)
- UGC permissions (API whitelist, execution limits)
- Streaming configuration (chunk loading)
- Runtime component filter (which components to include)

#### 3. WorldManager (`src/editor/core/WorldManager.ts`)

Manages separation between authoring and runtime worlds.

**Responsibilities:**
- Maintain `authoringWorld` (editor scene) and `runtimeWorld` (gameplay scene)
- Create immutable snapshots for restoration
- Clone authoring → runtime with component filtering
- Prevent cross-contamination

**Key Methods:**
- `snapshotAuthoring()` - Create immutable snapshot
- `buildRuntimeWorld(manifest)` - Clone with manifest filter
- `restoreAuthoring()` - Restore from snapshot
- `clearRuntimeWorld()` - Cleanup

#### 4. CameraDirector (`src/editor/camera/CameraDirector.ts`)

Unified camera management with smooth blending.

**Features:**
- Multiple camera modes: `orbit`, `fps`, `follow`
- Smooth blending between modes with `startBlend(mode, duration)`
- Centralized matrix generation
- Player position tracking for FPS mode

**Integration:**
- `app.ts` uses `CameraDirector.getViewMatrix()` instead of manual switching
- Blends cameras during PLAY_INTRO state

#### 5. InputContextManager (`src/input/InputContext.ts`)

Stack-based input context management.

**Features:**
- Push/pop context stack
- Per-context input maps and filters
- Pointer lock management
- Prevent editor shortcuts during gameplay

**Predefined Contexts:**
- `EditorInputContext` - Editor shortcuts (delete, undo, copy, etc.)
- `GameplayInputContext` - Gameplay controls (WASD, jump, interact)
- `MenuInputContext` - Menu navigation

### State Implementations

#### EDIT State (`src/editor/states/EditState.ts`)

**OnEnter:**
- Show editor UI
- Enable orbit camera
- Stop physics and scripts
- Enable history recording

**Active Systems:**
- Selection, gizmos, history
- Editor tools and panels

**Exit Trigger:**
- User clicks Play button → calls `requestPlayMode()`

#### PREFLIGHT State (`src/editor/states/PreflightState.ts`)

**OnEnter:**
- Run validation checks:
  - Renderer ready
  - Scene has entities
  - Find PlayerStart entity
  - Validate components (future)
  - Check script errors (future)
- Build PlayManifest
- Store validation errors/warnings

**Transitions:**
- Success → LOADING
- Failure → EDIT (with error report)

#### LOADING State (`src/editor/states/LoadingState.ts`)

**OnEnter:**
- Create authoring snapshot
- Build runtime world from manifest
- Setup physics systems
- Update scene buffers
- Pre-warm GPU pipelines (optional)

**Transitions:**
- Success → PLAY_INTRO
- Failure → RETURN

#### PLAY_INTRO State (`src/editor/states/PlayIntroState.ts`)

**OnEnter:**
- Push gameplay input context
- Spawn player at PlayerStart
- Start camera blend (orbit → FPS)
- Enable character input

**Duration:**
- Waits for camera blend to complete (~0.5s)

**Transitions:**
- Success → PLAYING
- Failure → RETURN

#### PLAYING State (`src/editor/states/PlayingState.ts`)

**OnUpdate:**
- Update FPS camera
- Update character input with camera directions
- Tick physics (with time scale)
- Tick character controllers
- Tick scripts (future)
- Tick audio (future)

**Controls:**
- Esc → pause() → PAUSED
- Stop button → stop() → RETURN

#### PAUSED State (`src/editor/states/PausedState.ts`)

**OnEnter:**
- Set time scale to 0 (freeze)
- Show pause menu

**OnExit:**
- Restore time scale to 1

**Actions:**
- `resume()` → PLAYING
- `restart()` → LOADING
- `stop()` → RETURN

#### RETURN State (`src/editor/states/ReturnState.ts`)

**OnEnter:**
- Stop runtime systems (physics, scripts, input)
- Pop gameplay input context
- Release pointer lock
- Switch camera to orbit
- Dispose runtime GPU resources
- Clear runtime world
- Restore authoring world from snapshot
- Update scene buffers

**Transitions:**
- Auto → EDIT

## Integration Points

### EditorModeManager (`src/editor/managers/EditorModeManager.ts`)

Refactored to use state machine internally while maintaining backward-compatible API.

**Public API:**
- `isPlayMode()` - Check if in play mode
- `enterPlayMode()` - Start play (triggers EDIT → PREFLIGHT transition)
- `exitPlayMode()` - Stop play (triggers RETURN)
- `pausePlayMode()` - Pause (PLAYING → PAUSED)
- `resumePlayMode()` - Resume (PAUSED → PLAYING)
- `getCurrentState()` - Get current state type
- `getCameraDirector()` - Access camera director
- `updatePlayMode(deltaTime)` - Update state machine

**Initialization:**
```typescript
await editorModeManager.initialize();
```

### EditorUI (`src/editor/ui/EditorUI.ts`)

- Initializes mode manager state machine during `initializeManagers()`
- Reacts to mode changes for UI visibility
- Passes renderer ready check to mode manager

### App (`src/app.ts`)

- Uses `CameraDirector` for unified camera matrix generation
- Delegates play mode updates to `modeManager.updatePlayMode(deltaTime)`
- Falls back to orbit controls if camera director not available

## Usage Example

```typescript
// In EditorUI or toolbar
async onPlayButtonClick() {
  await this.modeManager.enterPlayMode();
  // State machine handles:
  // 1. EDIT → PREFLIGHT (validate scene)
  // 2. PREFLIGHT → LOADING (build runtime)
  // 3. LOADING → PLAY_INTRO (spawn player, blend camera)
  // 4. PLAY_INTRO → PLAYING (start gameplay)
}

// In game loop
if (modeManager.isPlayMode()) {
  await modeManager.updatePlayMode(deltaTime);
  // State machine calls appropriate state's onUpdate()
  // Which updates physics, characters, scripts, etc.
}

// Pause game
if (escapePressed) {
  await modeManager.pausePlayMode();
  // PLAYING → PAUSED
  // Shows pause menu, freezes time
}

// Return to edit
async onStopButtonClick() {
  await modeManager.exitPlayMode();
  // Current state → RETURN → EDIT
  // Cleans up runtime, restores authoring
}
```

## Benefits

### 1. Separation of Concerns

- **Authoring World**: Editor components, gizmos, selection handles
- **Runtime World**: Physics, scripts, gameplay components
- No cross-contamination, clean state transitions

### 2. Proper Validation

- Preflight checks before play prevent runtime errors
- Manifest provides clear contract for runtime requirements
- Fail-fast with error reporting

### 3. Smooth Transitions

- Camera blending eliminates jarring jumps
- Input context switching prevents editor shortcuts during play
- Proper cleanup ensures no leaked state

### 4. Extensibility

- Easy to add new states (e.g., LOADING_ASSETS, STREAMING)
- Manifest can be extended with new settings
- State dependencies injected through constructor

### 5. Maintainability

- Clear state responsibilities
- Single source of truth (manifest)
- Backward-compatible API

## Future Enhancements

### Short Term
- [ ] Implement script validation in PREFLIGHT
- [ ] Add proper rotation handling for player spawn
- [ ] Implement pause menu UI
- [ ] Add restart functionality

### Medium Term
- [ ] GPU pipeline pre-warming in LOADING
- [ ] Streaming support for large worlds
- [ ] Save/load gameplay state
- [ ] Replay system

### Long Term
- [ ] Multiplayer state synchronization
- [ ] Hot reload during play mode
- [ ] Performance profiling per state
- [ ] State history/debugging tools

## Testing

Key areas to test:

1. **State Transitions**: Verify all valid transitions work
2. **Error Recovery**: Test invalid transitions and errors
3. **World Separation**: Ensure no authoring data leaks to runtime
4. **Camera Blending**: Smooth transitions between modes
5. **Input Contexts**: Correct input routing in each state
6. **Resource Cleanup**: No memory leaks on mode exit

## Files Created

### Core
- `src/editor/core/PlayModeStateMachine.ts` - State machine
- `src/editor/core/PlayManifest.ts` - Manifest types and validation
- `src/editor/core/WorldManager.ts` - World separation

### Systems
- `src/editor/camera/CameraDirector.ts` - Camera management
- `src/input/InputContext.ts` - Input context system

### States
- `src/editor/states/EditState.ts`
- `src/editor/states/PreflightState.ts`
- `src/editor/states/LoadingState.ts`
- `src/editor/states/PlayIntroState.ts`
- `src/editor/states/PlayingState.ts`
- `src/editor/states/PausedState.ts`
- `src/editor/states/ReturnState.ts`
- `src/editor/states/index.ts` - Exports

### Modified
- `src/editor/managers/EditorModeManager.ts` - Refactored to use state machine
- `src/editor/ui/EditorUI.ts` - Initialize mode manager
- `src/app.ts` - Use camera director
- `src/math.ts` - Added `mat4Lerp` for camera blending

## Conclusion

The play mode state machine provides a robust, extensible architecture for managing the Edit ↔ Play transition. It properly separates authoring from runtime, provides smooth transitions, validates before play, and maintains a clean state machine structure that's easy to understand and extend.

