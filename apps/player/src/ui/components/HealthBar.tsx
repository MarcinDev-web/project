import React from 'react';

export interface HealthBarProps {
  health: number;
  maxHealth: number;
}

/**
 * Health bar component
 */
export function HealthBar(props: HealthBarProps): React.JSX.Element {
  const { health, maxHealth } = props;
  const percentage = Math.max(0, Math.min(100, (health / maxHealth) * 100));

  return (
    <div style={styles.container}>
      <div style={styles.label}>Health</div>
      <div style={styles.barContainer}>
        <div style={styles.barBackground}>
          <div
            style={{
              ...styles.barFill,
              width: `${percentage}%`,
              backgroundColor: percentage > 50 ? '#4ade80' : percentage > 25 ? '#fbbf24' : '#ef4444',
            }}
          />
        </div>
        <div style={styles.text}>
          {Math.round(health)} / {maxHealth}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: '20px',
    left: '20px',
    pointerEvents: 'none',
    zIndex: 1001,
  },
  label: {
    color: '#fff',
    fontSize: '0.875rem',
    marginBottom: '0.25rem',
    fontWeight: 500,
  },
  barContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  barBackground: {
    width: '200px',
    height: '24px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: '4px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  barFill: {
    height: '100%',
    transition: 'width 0.3s ease, background-color 0.3s ease',
  },
  text: {
    color: '#fff',
    fontSize: '0.875rem',
    fontWeight: 500,
    minWidth: '60px',
    textAlign: 'right',
  },
};

