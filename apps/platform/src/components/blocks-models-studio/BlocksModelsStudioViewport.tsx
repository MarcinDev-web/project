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
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coreRef = useRef<BlocksModelsStudioCore | null>(null);
  const dragDropControllerRef = useRef<DragDropController | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const statusEl = statusRef.current;

    let mounted = true;

    const init = async () => {
      try {
        setIsInitializing(true);
        setError(null);

        const options: BlocksModelsStudioCoreOptions = {
          canvas,
          ...(statusEl && { statusEl }),
          ...(selectedBlock !== undefined && { selectedBlock }),
          ...(onBlockChange && { onBlockChange }),
        };

        const core = new BlocksModelsStudioCore(options);
        coreRef.current = core;

        await core.initialize();

        // Notify parent that core is ready
        if (onCoreReady) {
          onCoreReady(core);
        }

        // Initialize drag & drop controller
        const dragController = new DragDropController({
          canvas,
          controls: core.getControls(),
          scene: core.getScene(),
          getBlockEntityAt: (ray) => core.getBlockEntityAt(ray),
          onBlockPlaced: (block, position, scale) => {
            // Add block to scene with scale
            core.addBlock(block, position, scale);
            // Notify parent
            if (onBlockPlaced) {
              onBlockPlaced(block, position, scale);
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

        if (mounted) {
          setIsInitializing(false);
        }
      } catch (err) {
        console.error('Failed to initialize Blocks/Models Studio:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize');
          setIsInitializing(false);
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
  }, [onBlockPlaced, onCoreReady]); // Only run once on mount

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

