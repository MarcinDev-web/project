/**
 * AvatarCustomizationPanel - Main customization panel with all controls
 */

import { useState } from 'react';
import { AVATAR_SLOTS, type AvatarSlot, type AvatarLoadout } from '@engine/avatar';
import { ColorPicker } from './ColorPicker';
import { PartSelector } from './PartSelector';
import { MaterialSelector } from './MaterialSelector';
import { AvatarPreviewControls } from './AvatarPreviewControls';
import type { RgbaColor } from '@engine/world';

export interface AvatarCustomizationPanelProps {
  loadout: AvatarLoadout;
  onLoadoutChange: (loadout: AvatarLoadout) => void;
  onReset: () => void;
  onSave: () => void;
  isSaving?: boolean;
}

/**
 * Main customization panel component
 */
export function AvatarCustomizationPanel({
  loadout,
  onLoadoutChange,
  onReset,
  onSave,
  isSaving = false,
}: AvatarCustomizationPanelProps) {
  const [selectedSlot, setSelectedSlot] = useState<AvatarSlot | null>(null);
  const [activeTab, setActiveTab] = useState<'parts' | 'colors' | 'materials'>('parts');

  const selectedPart = selectedSlot ? loadout.parts[selectedSlot] : null;

  const handleColorChange = (colorSlot: string, color: RgbaColor) => {
    if (!selectedSlot) return;

    const part = loadout.parts[selectedSlot];
    const updatedPart = part
      ? {
          ...part,
          colors: {
            ...part.colors,
            [colorSlot]: color,
          },
        }
      : { mesh: 'default', colors: { [colorSlot]: color } };

    onLoadoutChange({
      ...loadout,
      parts: {
        ...loadout.parts,
        [selectedSlot]: updatedPart,
      },
    });
  };

  const handleMeshChange = (meshId: string) => {
    if (!selectedSlot) return;

    const part = loadout.parts[selectedSlot];
    const updatedPart = part
      ? { ...part, mesh: meshId }
      : { mesh: meshId };

    onLoadoutChange({
      ...loadout,
      parts: {
        ...loadout.parts,
        [selectedSlot]: updatedPart,
      },
    });
  };

  const handleMaterialChange = (materialId: string) => {
    if (!selectedSlot) return;

    const part = loadout.parts[selectedSlot];
    const updatedPart = part
      ? { ...part, material: materialId }
      : { mesh: 'default', material: materialId };

    onLoadoutChange({
      ...loadout,
      parts: {
        ...loadout.parts,
        [selectedSlot]: updatedPart,
      },
    });
  };

  return (
    <div className="avatar-customization-panel">
      <div className="avatar-panel-header">
        <h2>Avatar Customization</h2>
        <div className="avatar-panel-actions">
          <button onClick={onReset} disabled={isSaving} className="btn-secondary">
            Reset
          </button>
          <button onClick={onSave} disabled={isSaving} className="btn-primary">
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="avatar-panel-tabs">
        <button
          className={activeTab === 'parts' ? 'active' : ''}
          onClick={() => setActiveTab('parts')}
        >
          Parts
        </button>
        <button
          className={activeTab === 'colors' ? 'active' : ''}
          onClick={() => setActiveTab('colors')}
        >
          Colors
        </button>
        <button
          className={activeTab === 'materials' ? 'active' : ''}
          onClick={() => setActiveTab('materials')}
        >
          Materials
        </button>
      </div>

      <div className="avatar-panel-content">
        <div className="avatar-slot-selector">
          <label>Select Body Part</label>
          <select
            value={selectedSlot || ''}
            onChange={(e) => setSelectedSlot(e.target.value as AvatarSlot || null)}
          >
            <option value="">-- Select a part --</option>
            {AVATAR_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot.replace(/Slot/gi, '').replace(/([A-Z])/g, ' $1').trim()}
              </option>
            ))}
          </select>
        </div>

        {selectedSlot && (
          <div className="avatar-slot-editor">
            {activeTab === 'parts' && (
              <PartSelector
                slot={selectedSlot}
                {...(selectedPart?.mesh !== undefined && { currentMesh: selectedPart.mesh })}
                onMeshChange={handleMeshChange}
              />
            )}

            {activeTab === 'colors' && (
              <ColorPicker
                slot={selectedSlot}
                {...(selectedPart?.colors !== undefined && { colors: selectedPart.colors })}
                onColorChange={handleColorChange}
                {...(selectedPart?.mesh !== undefined && { currentMeshId: selectedPart.mesh })}
              />
            )}

            {activeTab === 'materials' && (
              <MaterialSelector
                slot={selectedSlot}
                {...(selectedPart?.material !== undefined && { currentMaterial: selectedPart.material })}
                onMaterialChange={handleMaterialChange}
              />
            )}
          </div>
        )}

        {!selectedSlot && (
          <div className="avatar-panel-empty">
            <p>Select a body part to customize</p>
          </div>
        )}
      </div>

      <AvatarPreviewControls />
    </div>
  );
}

