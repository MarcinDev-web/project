/**
 * AvatarBuilderViewport - React component managing canvas and game engine lifecycle
 */

import { useEffect, useRef, useState } from 'react';
import { AvatarBuilderCore, type AvatarBuilderCoreOptions } from './AvatarBuilderCore';
import type { AvatarLoadout } from '@engine/avatar';

export interface AvatarBuilderViewportProps {
  onLoadoutChange?: (loadout: AvatarLoadout) => void;
  initialLoadout?: AvatarLoadout;
  className?: string;
}

/**
 * React component that manages the WebGPU canvas and avatar rendering
 */
export function AvatarBuilderViewport({
  onLoadoutChange,
  initialLoadout,
  className,
}: AvatarBuilderViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coreRef = useRef<AvatarBuilderCore | null>(null);
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

        const options: AvatarBuilderCoreOptions = {
          canvas,
          ...(statusEl && { statusEl }),
          initialLoadout,
          onLoadoutChange,
        };

        const core = new AvatarBuilderCore(options);
        coreRef.current = core;

        await core.initialize();

        if (mounted) {
          setIsInitializing(false);
        }
      } catch (err) {
        console.error('Failed to initialize Avatar Builder:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize');
          setIsInitializing(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (coreRef.current) {
        coreRef.current.dispose();
        coreRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Update core when loadout changes externally
  useEffect(() => {
    if (coreRef.current && initialLoadout) {
      coreRef.current.applyLoadout(initialLoadout);
    }
  }, [initialLoadout]);

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
}

