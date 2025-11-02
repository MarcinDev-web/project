/**
 * PartSelector - Component for selecting mesh/parts for avatar slots
 */

import { DEFAULT_AVATAR_PART_LIBRARY, type AvatarSlot, type AvatarPartLibrary } from '@engine/avatar';

export interface PartSelectorProps {
  slot: AvatarSlot;
  currentMesh?: string;
  onMeshChange: (meshId: string) => void;
  partLibrary?: AvatarPartLibrary;
}

/**
 * Part selector component for choosing avatar part meshes
 * Uses the actual avatar part library to show available parts for each slot.
 */
export function PartSelector({ 
  slot, 
  currentMesh, 
  onMeshChange,
  partLibrary = DEFAULT_AVATAR_PART_LIBRARY 
}: PartSelectorProps) {
  // Get all parts that fit this slot from the library
  const getPartsForSlot = (): Array<{ id: string; displayName: string }> => {
    const parts: Array<{ id: string; displayName: string }> = [];
    
    for (const part of Object.values(partLibrary)) {
      if (part.slot === slot) {
        parts.push({
          id: part.id,
          displayName: part.displayName,
        });
      }
    }
    
    // Sort by display name for better UX
    parts.sort((a, b) => a.displayName.localeCompare(b.displayName));
    
    return parts;
  };

  const availableParts = getPartsForSlot();
  
  // If no parts found, provide fallback
  if (availableParts.length === 0) {
    const fallbackId = `${slot.toLowerCase().replace('slot', '')}_default`;
    return (
      <div className="part-selector">
        <h3>Part Selection</h3>
        <label>
          Mesh
          <select
            value={currentMesh || fallbackId}
            onChange={(e) => onMeshChange(e.target.value)}
            className="part-selector-select"
          >
            <option value={fallbackId}>{fallbackId}</option>
          </select>
        </label>
        <p style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>
          No parts available for this slot in the library.
        </p>
      </div>
    );
  }

  const selectedValue = currentMesh || availableParts[0]?.id || '';

  return (
    <div className="part-selector">
      <h3>Part Selection</h3>
      <label>
        Mesh ({availableParts.length} available)
        <select
          value={selectedValue}
          onChange={(e) => onMeshChange(e.target.value)}
          className="part-selector-select"
        >
          {availableParts.map((part) => (
            <option key={part.id} value={part.id}>
              {part.displayName}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

