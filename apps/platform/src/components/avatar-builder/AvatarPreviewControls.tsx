/**
 * AvatarPreviewControls - Camera and preview control buttons
 */

import type { AvatarAnimation } from '@engine/avatar';

export interface AvatarPreviewControlsProps {
  onResetCamera?: () => void;
  onRotateLeft?: () => void;
  onRotateRight?: () => void;
  onPlayAnimation?: (animation: AvatarAnimation) => void;
  onResetPose?: () => void;
  availableAnimations?: Array<{ animation: AvatarAnimation; name: string }>;
  currentAnimation?: AvatarAnimation | null;
}

/**
 * Preview controls for avatar viewport
 * Controls OrbitControls via callbacks from AvatarBuilderCore
 */
export function AvatarPreviewControls({
  onResetCamera,
  onRotateLeft,
  onRotateRight,
  onPlayAnimation,
  onResetPose,
  availableAnimations = [],
  currentAnimation,
}: AvatarPreviewControlsProps) {
  const handleAnimationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    const selected = availableAnimations.find((a) => a.animation.name === selectedName);
    if (selected && onPlayAnimation) {
      onPlayAnimation(selected.animation);
    }
  };

  return (
    <div className="avatar-preview-controls">
      <h3>Preview Controls</h3>
      
      {availableAnimations.length > 0 && (
        <div className="avatar-animation-controls">
          <label>
            Animation
            <select
              value={currentAnimation?.name || ''}
              onChange={handleAnimationChange}
              className="avatar-animation-select"
            >
              {availableAnimations.map(({ animation, name }) => (
                <option key={animation.name} value={animation.name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {onResetPose && (
            <button onClick={onResetPose} className="btn-secondary" title="Reset Pose">
              Reset Pose
            </button>
          )}
        </div>
      )}

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

