/**
 * AvatarPreviewControls - Camera and preview control buttons
 */

export interface AvatarPreviewControlsProps {
  onResetCamera?: () => void;
  onRotateLeft?: () => void;
  onRotateRight?: () => void;
}

/**
 * Preview controls for avatar viewport
 * 
 * Note: In full implementation, these would control OrbitControls
 * via refs or callbacks. For now, they're UI-only.
 */
export function AvatarPreviewControls({
  onResetCamera,
  onRotateLeft,
  onRotateRight,
}: AvatarPreviewControlsProps) {
  const handleReset = () => {
    onResetCamera?.();
    // Default behavior: scroll to center/reset view
    window.dispatchEvent(new Event('avatar-preview-reset'));
  };

  const handleRotateLeft = () => {
    onRotateLeft?.();
    window.dispatchEvent(new Event('avatar-preview-rotate-left'));
  };

  const handleRotateRight = () => {
    onRotateRight?.();
    window.dispatchEvent(new Event('avatar-preview-rotate-right'));
  };

  return (
    <div className="avatar-preview-controls">
      <h3>Preview Controls</h3>
      <div className="avatar-preview-buttons">
        <button onClick={handleReset} className="btn-secondary" title="Reset Camera">
          Reset View
        </button>
        <button onClick={handleRotateLeft} className="btn-secondary" title="Rotate Left">
          ↶
        </button>
        <button onClick={handleRotateRight} className="btn-secondary" title="Rotate Right">
          ↷
        </button>
      </div>
      <p className="avatar-preview-hint">
        Click and drag to rotate • Scroll to zoom
      </p>
    </div>
  );
}

