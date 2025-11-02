import { useToast, type Toast as ToastType } from '../../contexts/ToastContext';

interface ToastProps {
  toast: ToastType;
}

function Toast({ toast }: ToastProps) {
  const { hideToast } = useToast();

  const typeStyles = {
    success: { background: 'var(--color-success)', color: 'white' },
    error: { background: 'var(--color-error)', color: 'white' },
    warning: { background: 'var(--color-warning)', color: 'white' },
    info: { background: 'var(--bg-panel)', color: 'var(--text-1)' },
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        ...typeStyles[toast.type],
        padding: 'var(--spacing-4) var(--spacing-6)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--spacing-4)',
        minWidth: '300px',
        maxWidth: '500px',
        animation: 'slideInRight 0.3s ease-out',
      }}
    >
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => hideToast(toast.id)}
        aria-label="Close notification"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: 'var(--spacing-1)',
          fontSize: 'var(--text-lg)',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed',
        top: 'var(--spacing-4)',
        right: 'var(--spacing-4)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-3)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <Toast toast={toast} />
        </div>
      ))}
    </div>
  );
}

