import React from 'react';

export interface InventoryProps {
  onClose: () => void;
}

/**
 * Inventory component (placeholder - will be enhanced later)
 */
export function Inventory(props: InventoryProps): React.JSX.Element {
  const { onClose } = props;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.container} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Inventory</h2>
          <button style={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>
        <div style={styles.content}>
          <p style={styles.emptyMessage}>Inventory is empty</p>
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
    pointerEvents: 'all',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
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
    color: 'rgba(255, 255, 255, 0.7)',
  },
  emptyMessage: {
    textAlign: 'center',
    padding: '2rem',
  },
};

