/**
 * AvatarViewport - 3D avatar preview with camera and animation controls
 */

import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { AvatarBuilderCore } from '../avatar-builder/AvatarBuilderCore';
import type { AvatarLoadout, AvatarAnimation } from '@engine/avatar';
import { IDLE_ANIMATION, WALK_ANIMATION, RUN_ANIMATION } from '@engine/avatar';
import type { AnimationOption } from './types';

export interface AvatarViewportProps {
  loadout: AvatarLoadout;
  onLoadoutChange?: (loadout: AvatarLoadout) => void;
  onCoreReady?: (core: AvatarBuilderCore) => void;
}

/**
 * Animation options for the preview bar
 */
const ANIMATION_OPTIONS: AnimationOption[] = [
  { animation: IDLE_ANIMATION, icon: '🧍', label: 'Idle' },
  { animation: WALK_ANIMATION, icon: '🚶', label: 'Walk' },
  { animation: RUN_ANIMATION, icon: '🏃', label: 'Run' },
];

/**
 * Avatar viewport component with WebGPU rendering
 */
export const AvatarViewport = memo(function AvatarViewport({
  loadout,
  onLoadoutChange,
  onCoreReady,
}: AvatarViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coreRef = useRef<AvatarBuilderCore | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentAnimation, setCurrentAnimation] = useState<AvatarAnimation>(IDLE_ANIMATION);
  const lastLoadoutRef = useRef<AvatarLoadout | undefined>(loadout);

  // Initialize WebGPU
  // Use a ref to track the initializing core for proper cleanup in StrictMode
  const initializingCoreRef = useRef<AvatarBuilderCore | null>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let mounted = true;

    const init = async () => {
      try {
        setIsInitializing(true);
        setError(null);

        // Cleanup previous cores if they exist
        if (coreRef.current) {
          coreRef.current.dispose();
          coreRef.current = null;
        }
        if (initializingCoreRef.current) {
          initializingCoreRef.current.dispose();
          initializingCoreRef.current = null;
        }

        const core = new AvatarBuilderCore({
          canvas,
          initialLoadout: loadout,
          onLoadoutChange,
        });

        // Track in ref for cleanup during async initialization
        initializingCoreRef.current = core;
        await core.initialize();

        // Only set the ref and update state if still mounted
        // This prevents race conditions in React StrictMode
        if (mounted) {
          coreRef.current = core;
          initializingCoreRef.current = null; // Clear initializing ref
          setIsInitializing(false);
          onCoreReady?.(core);
        } else {
          // Component was unmounted during init - dispose the core
          core.dispose();
          initializingCoreRef.current = null;
        }
      } catch (err) {
        console.error('Failed to initialize Avatar Viewport:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize');
          setIsInitializing(false);
        }
        // Cleanup on error
        if (initializingCoreRef.current) {
          initializingCoreRef.current.dispose();
          initializingCoreRef.current = null;
        }
      }
    };

    init();

    return () => {
      mounted = false;
      // Dispose the initializing core if init was in progress
      if (initializingCoreRef.current) {
        initializingCoreRef.current.dispose();
        initializingCoreRef.current = null;
      }
      // Dispose the ref core if initialization completed
      if (coreRef.current) {
        coreRef.current.dispose();
        coreRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update loadout when it changes externally
  useEffect(() => {
    if (!coreRef.current || !loadout) return;

    const currentSerialized = JSON.stringify(loadout);
    const lastSerialized = JSON.stringify(lastLoadoutRef.current);

    if (currentSerialized !== lastSerialized) {
      // Debug: Log what's being applied
      const partCount = Object.keys(loadout.parts || {}).length;
      console.log(`[AvatarViewport] Applying loadout update: ${partCount} parts`, 
        Object.keys(loadout.parts || {}));
      
      coreRef.current.applyLoadout(loadout, true);
      lastLoadoutRef.current = loadout;
    }
  }, [loadout]);

  // Camera controls
  const handleRotateLeft = useCallback(() => {
    coreRef.current?.rotateLeft(0.3);
  }, []);

  const handleRotateRight = useCallback(() => {
    coreRef.current?.rotateRight(0.3);
  }, []);

  const handleResetCamera = useCallback(() => {
    coreRef.current?.resetCamera();
  }, []);

  // Animation controls
  const handleAnimationChange = useCallback((animation: AvatarAnimation) => {
    coreRef.current?.playAnimation(animation);
    setCurrentAnimation(animation);
  }, []);

  return (
    <div className="avatar-builder__viewport-area">
      <div className="avatar-builder__viewport">
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            outline: 'none',
          }}
        />

        {/* Camera controls overlay */}
        {!isInitializing && !error && (
          <div className="avatar-builder__viewport-overlay">
            <button
              className="avatar-builder__camera-btn"
              onClick={handleRotateLeft}
              title="Rotate left"
            >
              ◀
            </button>
            <button
              className="avatar-builder__camera-btn"
              onClick={handleResetCamera}
              title="Reset camera"
            >
              ⟲
            </button>
            <button
              className="avatar-builder__camera-btn"
              onClick={handleRotateRight}
              title="Rotate right"
            >
              ▶
            </button>
          </div>
        )}

        {/* Loading state */}
        {isInitializing && !error && (
          <div className="forge-loading" style={{ position: 'absolute', inset: 0 }}>
            <div className="forge-loading__spinner" />
            <span>Initializing WebGPU...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.9)',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</span>
            <h3 style={{ color: 'var(--forge-error)', marginBottom: '0.5rem' }}>
              WebGPU Error
            </h3>
            <p style={{ color: 'var(--forge-text-muted)', maxWidth: '400px' }}>
              {error}
            </p>
            {error.includes('WebGPU not supported') && (
              <p style={{ color: 'var(--forge-text-muted)', fontSize: '0.875rem', marginTop: '1rem' }}>
                Please use Chrome 113+, Edge 113+, or Safari 18.0+
              </p>
            )}
          </div>
        )}
      </div>

      {/* Animation bar */}
      <AnimationBar
        animations={ANIMATION_OPTIONS}
        currentAnimation={currentAnimation}
        onAnimationChange={handleAnimationChange}
        disabled={isInitializing || !!error}
      />
    </div>
  );
});

interface AnimationBarProps {
  animations: AnimationOption[];
  currentAnimation: AvatarAnimation;
  onAnimationChange: (animation: AvatarAnimation) => void;
  disabled?: boolean;
}

const AnimationBar = memo(function AnimationBar({
  animations,
  currentAnimation,
  onAnimationChange,
  disabled = false,
}: AnimationBarProps) {
  return (
    <div className="animation-bar">
      {animations.map((option) => (
        <button
          key={option.animation.name}
          className={`animation-bar__btn ${
            currentAnimation.name === option.animation.name ? 'animation-bar__btn--active' : ''
          }`}
          onClick={() => onAnimationChange(option.animation)}
          disabled={disabled}
          title={option.label}
        >
          <span className="animation-bar__icon">{option.icon}</span>
          <span className="animation-bar__label">{option.label}</span>
        </button>
      ))}
    </div>
  );
});

