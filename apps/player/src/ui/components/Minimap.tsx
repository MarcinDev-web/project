import React from 'react';
import type { Vec3 } from '@engine/core/math';

export interface MinimapProps {
  playerPosition: Vec3;
}

/**
 * Minimap component (placeholder - will be enhanced later)
 */
export function Minimap(props: MinimapProps): React.JSX.Element {
  const { playerPosition } = props;

  return (
    <div style={styles.container}>
      <div style={styles.title}>Minimap</div>
      <div style={styles.map}>
        <div style={styles.playerDot} />
        <div style={styles.positionText}>
          {playerPosition[0].toFixed(1)}, {playerPosition[1].toFixed(1)}, {playerPosition[2].toFixed(1)}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    width: '200px',
    height: '200px',
    backgroundColor: 'rgba(15, 19, 24, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '0.5rem',
    pointerEvents: 'none',
    zIndex: 1001,
  },
  title: {
    color: '#fff',
    fontSize: '0.75rem',
    marginBottom: '0.5rem',
    fontWeight: 500,
  },
  map: {
    width: '100%',
    height: 'calc(100% - 1.5rem)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '4px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#4a9eff',
    borderRadius: '50%',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
  positionText: {
    position: 'absolute',
    bottom: '0.25rem',
    left: '0.25rem',
    right: '0.25rem',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '0.625rem',
    textAlign: 'center',
  },
};

