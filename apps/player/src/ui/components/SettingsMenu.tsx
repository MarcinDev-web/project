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
            <p style={styles.placeholder}>Graphics settings coming soon...</p>
          </div>
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Audio</h3>
            <p style={styles.placeholder}>Audio settings coming soon...</p>
          </div>
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Controls</h3>
            <p style={styles.placeholder}>Control settings coming soon...</p>
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
};

