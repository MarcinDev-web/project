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
 * Controls OrbitControls via callbacks from AvatarBuilderCore
 */
export function AvatarPreviewControls({
  onResetCamera,
  onRotateLeft,
  onRotateRight,
}: AvatarPreviewControlsProps) {
  return (
    <div className="avatar-preview-controls">
      <h3>Preview Controls</h3>
      <div className="avatar-preview-buttons">
        <button onClick={onResetCamera} className="btn-secondary" title="Reset Camera">
          Reset View
        </button>
        <button onClick={onRotateLeft} className="btn-secondary btn-rotate" title="Rotate Left">
          ↶
        </button>
        <button onClick={onRotateRight} className="btn-secondary btn-rotate" title="Rotate Right">
          ↷
        </button>
      </div>
      <p className="avatar-preview-hint">
        Click and drag to rotate. Scroll to zoom.
      </p>
    </div>
  );
}

