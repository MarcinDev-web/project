/**
 * PresetsPanel - Right sidebar for managing avatar presets
 */

import { memo, useState, useCallback } from 'react';
import type { AvatarPreset } from './types';

export interface PresetsPanelProps {
  presets: AvatarPreset[];
  activePresetId: string | null;
  onPresetSelect: (preset: AvatarPreset) => void;
  onPresetCreate: (name: string) => void;
  onPresetDelete?: (presetId: string) => void;
}

/**
 * Presets panel component
 */
export const PresetsPanel = memo(function PresetsPanel({
  presets,
  activePresetId,
  onPresetSelect,
  onPresetCreate,
  onPresetDelete,
}: PresetsPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const handleCreateClick = useCallback(() => {
    setIsCreating(true);
    setNewPresetName('');
  }, []);

  const handleCreateSubmit = useCallback(() => {
    if (newPresetName.trim()) {
      onPresetCreate(newPresetName.trim());
      setIsCreating(false);
      setNewPresetName('');
    }
  }, [newPresetName, onPresetCreate]);

  const handleCreateCancel = useCallback(() => {
    setIsCreating(false);
    setNewPresetName('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCreateSubmit();
      } else if (e.key === 'Escape') {
        handleCreateCancel();
      }
    },
    [handleCreateSubmit, handleCreateCancel]
  );

  return (
    <aside className="presets-panel">
      <div className="presets-panel__header">
        <h3 className="presets-panel__title">Presets</h3>
      </div>

      <div className="presets-panel__list">
        {presets.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            isActive={activePresetId === preset.id}
            onClick={() => onPresetSelect(preset)}
            onDelete={
              preset.isDefault || !onPresetDelete
                ? undefined
                : () => onPresetDelete(preset.id)
            }
          />
        ))}

        {presets.length === 0 && (
          <div className="forge-empty" style={{ padding: '1rem' }}>
            <span className="forge-empty__icon" style={{ fontSize: '2rem' }}>
              📋
            </span>
            <p className="forge-empty__description" style={{ fontSize: '0.75rem' }}>
              No presets yet
            </p>
          </div>
        )}
      </div>

      {isCreating ? (
        <div style={{ padding: 'var(--forge-spacing-sm)', display: 'flex', gap: 'var(--forge-spacing-xs)', flexDirection: 'column' }}>
          <input
            type="text"
            className="color-picker-advanced__hex-input"
            placeholder="Preset name..."
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 'var(--forge-spacing-xs)' }}>
            <button className="forge-btn forge-btn--primary" style={{ flex: 1, padding: '0.5rem' }} onClick={handleCreateSubmit}>
              Save
            </button>
            <button className="forge-btn forge-btn--ghost" style={{ padding: '0.5rem' }} onClick={handleCreateCancel}>
              ✕
            </button>
          </div>
        </div>
      ) : (
        <button className="presets-panel__create-btn" onClick={handleCreateClick}>
          <span>+</span>
          <span>New Preset</span>
        </button>
      )}
    </aside>
  );
});

interface PresetCardProps {
  preset: AvatarPreset;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
}

const PresetCard = memo(function PresetCard({
  preset,
  isActive,
  onClick,
  onDelete,
}: PresetCardProps) {
  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.();
    },
    [onDelete]
  );

  return (
    <div
      className={`preset-card ${isActive ? 'preset-card--active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="preset-card__thumbnail">
        {preset.previewEmoji ?? '👤'}
      </div>
      <div className="preset-card__info">
        <h4 className="preset-card__name">{preset.name}</h4>
        <span className="preset-card__meta">
          {preset.isDefault ? 'Default' : formatDate(preset.updatedAt)}
        </span>
      </div>
      {onDelete && (
        <button
          className="forge-btn forge-btn--ghost forge-btn--icon"
          onClick={handleDeleteClick}
          title="Delete preset"
          style={{ 
            width: '28px', 
            height: '28px', 
            padding: 0, 
            fontSize: '0.75rem',
            opacity: 0.5,
          }}
        >
          🗑️
        </button>
      )}
    </div>
  );
});

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

