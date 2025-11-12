/**
 * Bootstrap player runtime - initializes all systems and starts game loop
 */

import { initRenderer } from '@engine/gfx-webgpu';
import { Scene } from '@engine/world';
import { PhysicsWorld } from '@engine/world';
import { CharacterControllerSystem, GroundDetectionSystem } from '@engine/stdlib/CharacterController';
import { FPSCamera } from '@engine/camera';
import { CharacterInputHandler } from '@engine/input';
import { PlayerModeManager } from './managers/PlayerModeManager.js';
import { PlayerStateType } from './core/PlayerStateMachine.js';
import { Logger } from './utils/logger';
import { requirePlayerDom } from './utils/dom';
import { initHUD } from './ui/index.js';
import type { HUDProps } from './ui/HUD.js';

export async function bootstrap(): Promise<void> {
  const dom = requirePlayerDom();
  
  // Show loading
  if (dom.loadingEl) {
    dom.loadingEl.style.display = 'block';
  }
  
  if (dom.statusEl) {
    dom.statusEl.textContent = 'Initializing WebGPU...';
  }
  
  try {
    // Get buildId from URL query string
    const urlParams = new URLSearchParams(window.location.search);
    const buildId = urlParams.get('buildId');
    
    if (!buildId) {
      throw new Error('Missing buildId parameter in URL');
    }
    
    // Initialize renderer
    if (dom.statusEl) {
      dom.statusEl.textContent = 'Initializing renderer...';
    }
    
    const scene = new Scene('Player Scene');
    const renderer = await initRenderer({
      canvas: dom.canvas,
      statusEl: dom.statusEl,
      getOrbitState: () => ({ yaw: 0, pitch: 0, distance: 10 }),
      scene,
      shouldSimulate: () => true, // Always simulate in player mode
      onFrameUpdate: () => {
        // Game loop will be handled by PlayerModeManager
      },
    });
    
    // Initialize physics
    if (dom.statusEl) {
      dom.statusEl.textContent = 'Initializing physics...';
    }
    
    const physicsWorld = new PhysicsWorld(scene);
    
    // Initialize ground detection system
    const groundDetectionSystem = new GroundDetectionSystem(scene, physicsWorld);
    
    // Initialize character system
    const characterSystem = new CharacterControllerSystem(scene, physicsWorld);
    
    // Initialize input
    const characterInput = new CharacterInputHandler();
    
    // Initialize FPS camera
    const fpsCamera = new FPSCamera(dom.canvas, {
      eyeHeight: 1.6,
      sensitivity: 0.0025,
    });
    
    // Initialize PlayerModeManager
    if (dom.statusEl) {
      dom.statusEl.textContent = 'Loading game...';
    }
    
    // Initialize HUD state
    let showPauseMenu = false;
    let showDisconnectUI = false;
    let hudUnmount: (() => void) | null = null;
    let playerManager: PlayerModeManager;
    
    // Initialize HUD update function (will be called after playerManager is created)
    const updateHUD = () => {
      if (hudUnmount) {
        hudUnmount();
      }
      
      const hudProps: HUDProps = {
        showPauseMenu,
        showDisconnectUI,
        onResume: () => {
          playerManager.requestResume();
        },
        onExit: () => {
          void playerManager.exit();
        },
        onReconnect: () => {
          void playerManager.requestReconnect();
        },
      };
      
      hudUnmount = initHUD(hudProps);
    };
    
    playerManager = new PlayerModeManager({
      canvas: dom.canvas,
      scene,
      renderer,
      physicsWorld,
      characterSystem,
      groundDetectionSystem,
      characterInput,
      fpsCamera,
      onLoadingProgress: (step: string, percentage: number, message?: string) => {
        if (dom.statusEl) {
          dom.statusEl.textContent = `${step} ${percentage}%${message ? ` - ${message}` : ''}`;
        }
      },
      onPauseMenuVisibilityChange: (visible: boolean) => {
        showPauseMenu = visible;
        updateHUD();
        Logger.debug(`Pause menu visibility: ${visible}`);
      },
      onDisconnectUIVisibilityChange: (visible: boolean) => {
        showDisconnectUI = visible;
        updateHUD();
        Logger.debug(`Disconnect UI visibility: ${visible}`);
      },
    });
    
    // Initial HUD render (after playerManager is created)
    updateHUD();
    
    // Initialize player mode (loads build data, spawns player, etc.)
    await playerManager.initialize(buildId);
    
    // Hide loading when state changes to PLAYING
    const checkState = () => {
      const state = playerManager.getCurrentState();
      if (state === PlayerStateType.PLAYING) {
        if (dom.loadingEl) {
          dom.loadingEl.style.display = 'none';
        }
        if (dom.statusEl) {
          dom.statusEl.style.display = 'none';
        }
      }
    };
    
    // Show exit button
    if (dom.exitButton) {
      dom.exitButton.style.display = 'block';
      dom.exitButton.addEventListener('click', () => {
        void playerManager.exit();
      });
    }
    
    // Setup pause/resume on Escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const state = playerManager.getCurrentState();
        if (state === PlayerStateType.PLAYING) {
          playerManager.requestPause();
        } else if (state === PlayerStateType.PAUSED) {
          playerManager.requestResume();
        }
      }
    });
    
    // Game loop
    let lastTime = performance.now();
    function gameLoop(currentTime: number): void {
      const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap at 100ms
      lastTime = currentTime;
      
      try {
        playerManager.update(deltaTime);
        checkState(); // Check for state changes to hide loading
      } catch (error) {
        Logger.error('Game loop error:', error as Error);
      }
      
      requestAnimationFrame(gameLoop);
    }
    
    // Start game loop
    requestAnimationFrame(gameLoop);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (hudUnmount) {
        hudUnmount();
      }
      playerManager.dispose();
    }, { once: true });
    
    Logger.info('Player runtime initialized successfully');
  } catch (error) {
    Logger.error('Bootstrap failed:', error as Error);
    
    // Hide loading
    if (dom.loadingEl) {
      dom.loadingEl.style.display = 'none';
    }
    
    // Show error
    if (dom.errorEl) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      dom.errorEl.textContent = `Failed to start game: ${errorMessage}`;
      dom.errorEl.style.display = 'block';
      
      // Add retry button
      const retryButton = document.createElement('button');
      retryButton.textContent = 'Retry';
      retryButton.style.cssText = `
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        color: white;
        cursor: pointer;
      `;
      retryButton.addEventListener('click', () => {
        window.location.reload();
      });
      dom.errorEl.appendChild(retryButton);
    }
    
    if (dom.statusEl) {
      dom.statusEl.textContent = 'Failed to initialize';
    }
    
    throw error;
  }
}

