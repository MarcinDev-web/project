import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerStateMachine, PlayerStateType } from '../core/PlayerStateMachine.js';
import { LoadingState } from '../core/states/LoadingState.js';
import { PlayingState } from '../core/states/PlayingState.js';
import { PausedState } from '../core/states/PausedState.js';

describe('PlayerStateMachine', () => {
  let stateMachine: PlayerStateMachine;

  beforeEach(() => {
    stateMachine = new PlayerStateMachine();
  });

  it('should initialize to LOADING state', () => {
    const loadingState = new LoadingState({
      loadBuildData: vi.fn().mockResolvedValue({}),
    });
    
    stateMachine.registerState(loadingState);
    stateMachine.initialize(PlayerStateType.LOADING);
    
    expect(stateMachine.getCurrentStateType()).toBe(PlayerStateType.LOADING);
  });

  it('should transition between states', () => {
    const loadingState = new LoadingState({
      loadBuildData: vi.fn().mockResolvedValue({}),
    });
    const playingState = new PlayingState({
      updateGame: vi.fn(),
    });
    
    stateMachine.registerState(loadingState);
    stateMachine.registerState(playingState);
    stateMachine.initialize(PlayerStateType.LOADING);
    
    expect(stateMachine.getCurrentStateType()).toBe(PlayerStateType.LOADING);
    
    const success = stateMachine.transitionTo(PlayerStateType.PLAYING);
    expect(success).toBe(true);
    expect(stateMachine.getCurrentStateType()).toBe(PlayerStateType.PLAYING);
  });

  it('should prevent invalid transitions', () => {
    const loadingState = new LoadingState({
      loadBuildData: vi.fn().mockResolvedValue({}),
    });
    const pausedState = new PausedState({
      setTimeScale: vi.fn(),
      setPauseMenuVisible: vi.fn(),
    });
    
    stateMachine.registerState(loadingState);
    stateMachine.registerState(pausedState);
    stateMachine.initialize(PlayerStateType.LOADING);
    
    // Cannot transition from LOADING to PAUSED
    const success = stateMachine.transitionTo(PlayerStateType.PAUSED);
    expect(success).toBe(false);
    expect(stateMachine.getCurrentStateType()).toBe(PlayerStateType.LOADING);
  });

  it('should update current state', () => {
    const playingState = new PlayingState({
      updateGame: vi.fn(),
    });
    
    stateMachine.registerState(playingState);
    stateMachine.initialize(PlayerStateType.PLAYING);
    
    const transitioned = stateMachine.update(0.016);
    expect(transitioned).toBe(false); // No transition
    expect(stateMachine.getCurrentStateType()).toBe(PlayerStateType.PLAYING);
  });

  it('should dispose correctly', () => {
    const loadingState = new LoadingState({
      loadBuildData: vi.fn().mockResolvedValue({}),
    });
    
    stateMachine.registerState(loadingState);
    stateMachine.initialize(PlayerStateType.LOADING);
    
    stateMachine.dispose();
    
    expect(stateMachine.getCurrentStateType()).toBeNull();
  });
});

