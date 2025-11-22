import React from 'react';

export interface SettingsMenuProps {
  onClose: () => void;
}

/**
 * Settings menu component (placeholder - will be enhanced later)
 */
export function SettingsMenu(props: SettingsMenuProps): React.JSX.Element {
  const { onClose } = props;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.container} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Settings</h2>
          <button style={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>
        <div style={styles.content}>
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Graphics</h3>
            <div style={styles.controlGroup}>
              <label style={styles.label}>Shadow Quality</label>
              <select style={styles.select} defaultValue="high">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div style={styles.controlGroup}>
              <label style={styles.label}>Anti-Aliasing</label>
              <select style={styles.select} defaultValue="on">
                <option value="off">Off</option>
                <option value="on">On (FXAA)</option>
              </select>
            </div>
          </div>
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Audio</h3>
            <div style={styles.controlGroup}>
              <label style={styles.label}>Master Volume</label>
              <input type="range" min="0" max="100" defaultValue="80" style={styles.range} />
            </div>
          </div>
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Controls</h3>
            <div style={styles.controlList}>
              <div style={styles.controlRow}>
                <span>Move Forward</span>
                <span style={styles.key}>W</span>
              </div>
              <div style={styles.controlRow}>
                <span>Move Backward</span>
                <span style={styles.key}>S</span>
              </div>
              <div style={styles.controlRow}>
                <span>Move Left</span>
                <span style={styles.key}>A</span>
              </div>
              <div style={styles.controlRow}>
                <span>Move Right</span>
                <span style={styles.key}>D</span>
              </div>
              <div style={styles.controlRow}>
                <span>Jump</span>
                <span style={styles.key}>Space</span>
              </div>
              <div style={styles.controlRow}>
                <span>Sprint</span>
                <span style={styles.key}>Shift</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    pointerEvents: 'all',
  },
  container: {
    width: '600px',
    maxHeight: '80vh',
    backgroundColor: 'rgba(15, 19, 24, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '1.5rem',
    overflowY: 'auto',
    pointerEvents: 'all',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  title: {
    color: '#fff',
    fontSize: '1.5rem',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '2rem',
    cursor: 'pointer',
    padding: 0,
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  section: {
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: '1.125rem',
    marginBottom: '0.5rem',
    margin: 0,
  },
  placeholder: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.875rem',
  },
  controlGroup: {
    marginBottom: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '0.9rem',
  },
  select: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    color: '#fff',
    padding: '0.25rem 0.5rem',
    minWidth: '120px',
  },
  range: {
    width: '150px',
  },
  controlList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  controlRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '4px',
    fontSize: '0.9rem',
  },
  key: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '3px',
    padding: '0.1rem 0.4rem',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
  },
};

