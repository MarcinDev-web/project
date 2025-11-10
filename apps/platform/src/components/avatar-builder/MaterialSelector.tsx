/**
 * MaterialSelector - Component for selecting materials for avatar parts
 */

import type { AvatarSlot } from '@engine/avatar';

export interface MaterialSelectorProps {
  slot: AvatarSlot;
  currentMaterial?: string;
  onMaterialChange: (materialId: string) => void;
  availableMaterials?: Array<{ id: string; name: string }>;
}

/**
 * Material selector component for choosing materials
 * Uses available materials from MaterialResolver if provided, otherwise falls back to default list
 */
export function MaterialSelector({
  slot: _slot,
  currentMaterial,
  onMaterialChange,
  availableMaterials,
}: MaterialSelectorProps) {
  // Use provided materials or fallback to default list
  const materialOptions = availableMaterials ?? [
    { id: 'mat_default', name: 'Default' },
    { id: 'mat_glossy', name: 'Glossy' },
    { id: 'mat_matte', name: 'Matte' },
    { id: 'mat_metallic', name: 'Metallic' },
    { id: 'mat_rough', name: 'Rough' },
  ];

  const selectedValue = currentMaterial || materialOptions[0]?.id || 'mat_default';

  return (
    <div className="material-selector">
      <h3>Material</h3>
      <label>
        Material Type
        <select
          value={selectedValue}
          onChange={(e) => onMaterialChange(e.target.value)}
          className="material-selector-select"
        >
          {materialOptions.map((mat) => (
            <option key={mat.id} value={mat.id}>
              {mat.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

