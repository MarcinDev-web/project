/**
 * BlocksModelsStudioViewport - React component managing canvas and game engine lifecycle
 */

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { BlocksModelsStudioCore, type BlocksModelsStudioCoreOptions } from './BlocksModelsStudioCore';
import { DragDropController } from './DragDropController';
import type { BlockDefinition } from '@engine/blocks';
import type { Vec3 } from '@engine/core/math';

export interface BlocksModelsStudioViewportProps {
  onBlockChange?: (block: BlockDefinition) => void;
  selectedBlock?: BlockDefinition | null;
  onBlockPlaced?: (block: BlockDefinition, position: Vec3, scale: Vec3) => void;
  className?: string;
  onCoreReady?: (core: BlocksModelsStudioCore) => void;
  onError?: (error: string) => void;
}

/**
 * React component that manages the WebGPU canvas and block/model rendering
 */
export const BlocksModelsStudioViewport = forwardRef<HTMLCanvasElement, BlocksModelsStudioViewportProps>(({
  onBlockChange,
  selectedBlock,
  onBlockPlaced,
  className,
  onCoreReady,
  onError,
}, ref) => {
  console.log('[BlocksModelsStudioViewport] Component rendering');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coreRef = useRef<BlocksModelsStudioCore | null>(null);
  const dragDropControllerRef = useRef<DragDropController | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  // Store callbacks in refs to avoid re-running effect
  const onCoreReadyRef = useRef(onCoreReady);
  const onBlockPlacedRef = useRef(onBlockPlaced);
  const onErrorRef = useRef(onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onCoreReadyRef.current = onCoreReady;
    onBlockPlacedRef.current = onBlockPlaced;
    onErrorRef.current = onError;
  }, [onCoreReady, onBlockPlaced, onError]);

  useEffect(() => {
    console.log('[BlocksModelsStudioViewport] useEffect triggered');
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn('[BlocksModelsStudioViewport] Canvas not available yet');
      return;
    }

    // Prevent multiple initializations
    if (coreRef.current) {
      console.warn('[BlocksModelsStudioViewport] Core already initialized, skipping');
      return;
    }

    console.log('[BlocksModelsStudioViewport] Canvas found:', canvas);
    const statusEl = statusRef.current;

    let mounted = true;

    const init = async () => {
      try {
        setIsInitializing(true);
        setError(null);
        console.log('[BlocksModelsStudioViewport] Starting initialization...');

        // Ensure canvas has valid size
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          console.warn('[BlocksModelsStudioViewport] Canvas has zero size, waiting for resize...');
          // Wait a bit for layout to settle
          await new Promise(resolve => setTimeout(resolve, 100));
          const newRect = canvas.getBoundingClientRect();
          if (newRect.width === 0 || newRect.height === 0) {
            throw new Error('Canvas has zero size. Please ensure the viewport container has dimensions.');
          }
        }

        // Set canvas size explicitly
        canvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
        canvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
        console.log('[BlocksModelsStudioViewport] Canvas size:', canvas.width, 'x', canvas.height);

        const options: BlocksModelsStudioCoreOptions = {
          canvas,
          ...(statusEl && { statusEl }),
          ...(selectedBlock !== undefined && { selectedBlock }),
          ...(onBlockChange && { onBlockChange }),
        };

        // Double-check that core wasn't initialized by another effect run
        if (coreRef.current) {
          console.warn('[BlocksModelsStudioViewport] Core already exists, skipping initialization');
          return;
        }

        console.log('[BlocksModelsStudioViewport] Creating BlocksModelsStudioCore...');
        const core = new BlocksModelsStudioCore(options);
        coreRef.current = core;

        console.log('[BlocksModelsStudioViewport] Initializing core...');
        await core.initialize();
        console.log('[BlocksModelsStudioViewport] Core initialized successfully');

        // Notify parent that core is ready (always call, even if there were errors)
        console.log('[BlocksModelsStudioViewport] Notifying parent that core is ready...');
        if (onCoreReadyRef.current && mounted) {
          try {
            onCoreReadyRef.current(core);
            console.log('[BlocksModelsStudioViewport] onCoreReady callback executed');
          } catch (callbackError) {
            console.error('[BlocksModelsStudioViewport] Error in onCoreReady callback:', callbackError);
          }
        }

        // Initialize drag & drop controller
        console.log('[BlocksModelsStudioViewport] Initializing drag & drop controller...');
        const dragController = new DragDropController({
          canvas,
          controls: core.getControls(),
          scene: core.getScene(),
          getBlockEntityAt: (ray) => core.getBlockEntityAt(ray),
          onBlockPlaced: (block, position, scale) => {
            // Add block to scene with scale
            core.addBlock(block, position, scale);
            // Notify parent
            if (onBlockPlacedRef.current) {
              onBlockPlacedRef.current(block, position, scale);
            }
          },
          onStatusMessage: (message, duration) => {
            if (statusEl) {
              statusEl.textContent = message;
              if (duration) {
                setTimeout(() => {
                  if (statusEl) statusEl.textContent = '';
                }, duration);
              }
            }
          },
        });

        dragController.initialize();
        dragDropControllerRef.current = dragController;
        console.log('[BlocksModelsStudioViewport] Initialization complete');

        if (mounted) {
          setIsInitializing(false);
        }
      } catch (err) {
        console.error('Failed to initialize Blocks/Models Studio:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize';
        if (mounted) {
          setError(errorMessage);
          setIsInitializing(false);
          // Notify parent about error
          if (onErrorRef.current) {
            try {
              onErrorRef.current(errorMessage);
            } catch (callbackError) {
              console.error('Error in onError callback:', callbackError);
            }
          }
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (dragDropControllerRef.current) {
        dragDropControllerRef.current.dispose();
        dragDropControllerRef.current = null;
      }
      if (coreRef.current) {
        coreRef.current.dispose();
        coreRef.current = null;
      }
    };
  }, []); // Empty deps - only run once on mount

  // Start drag from palette
  const startBlockDrag = useCallback((block: BlockDefinition, scale: Vec3) => {
    if (dragDropControllerRef.current) {
      dragDropControllerRef.current.startDragNewBlock(block, scale);
    }
  }, []);

  // Expose canvas and drag function via ref
  useImperativeHandle(ref, () => canvasRef.current!, []);
  
  useEffect(() => {
    if (canvasRef.current) {
      (canvasRef.current as any).startBlockDrag = startBlockDrag;
    }
  }, [startBlockDrag]);

  // Update preview when selected block changes
  useEffect(() => {
    if (coreRef.current && selectedBlock) {
      coreRef.current.previewBlock(selectedBlock);
    }
  }, [selectedBlock]);

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          outline: 'none',
        }}
        onDrop={async (e) => {
          e.preventDefault();
          try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            const blockId = data.blockId;
            const scale = data.scale || [1, 1, 1];
            
            // Find block in library
            const module = await import('@engine/blocks');
            const block = module.BLOCK_LIBRARY[blockId];
            if (block && dragDropControllerRef.current) {
              dragDropControllerRef.current.startDragNewBlock(block, scale);
            }
          } catch (error) {
            // Ignore invalid drop data
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
      />
      {statusRef && (
        <div
          ref={statusRef}
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            padding: '8px 12px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            borderRadius: '4px',
            fontSize: '14px',
            pointerEvents: 'none',
          }}
        />
      )}
      {isInitializing && !error && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '16px 24px',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            borderRadius: '8px',
            fontSize: '16px',
          }}
        >
          Initializing WebGPU...
        </div>
      )}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '24px 32px',
            background: 'rgba(200, 0, 0, 0.95)',
            color: 'white',
            borderRadius: '8px',
            fontSize: '16px',
            textAlign: 'center',
            maxWidth: '500px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ marginBottom: '12px', fontWeight: 'bold', fontSize: '18px' }}>
            WebGPU Error
          </div>
          <div style={{ marginBottom: '16px', lineHeight: '1.5' }}>{error}</div>
          {error.includes('WebGPU not supported') && (
            <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.3)' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>WebGPU requires:</strong>
              </div>
              <div style={{ textAlign: 'left', fontSize: '13px' }}>
                <div>• Chrome 113+, Edge 113+, or Opera 99+</div>
                <div>• Firefox 110+ (experimental)</div>
                <div>• Safari 18.0+ (macOS/iOS)</div>
                <div style={{ marginTop: '8px', opacity: 0.8 }}>
                  Please update your browser or try a different browser.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

BlocksModelsStudioViewport.displayName = 'BlocksModelsStudioViewport';

