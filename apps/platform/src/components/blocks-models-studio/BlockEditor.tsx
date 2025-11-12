/**
 * BlockEditor - Advanced block editor with live 3D preview and form
 */

import { useState, useEffect } from 'react';
import type { BlockDefinition, BlockCategory, BlockMaterialType } from '@engine/blocks';
import type { RgbaColor } from '@engine/world';

export interface BlockEditorProps {
  selectedBlock: BlockDefinition | null;
  onBlockChange: (block: BlockDefinition) => void;
}

/**
 * Block editor component with form and live preview
 */
export function BlockEditor({ selectedBlock, onBlockChange }: BlockEditorProps) {
  const [customBlocks, setCustomBlocks] = useState<BlockDefinition[]>([]);
  const [showBlockList, setShowBlockList] = useState(true);
  
  const [block, setBlock] = useState<Partial<BlockDefinition>>(
    selectedBlock || {
      id: '',
      name: '',
      category: 'basic',
      material: 'plastic',
      textures: {
        top: { color: [0.5, 0.5, 0.5, 1], pattern: 'smooth', brightness: 1.0 },
        bottom: { color: [0.5, 0.5, 0.5, 1], pattern: 'smooth', brightness: 0.8 },
        sides: { color: [0.5, 0.5, 0.5, 1], pattern: 'smooth', brightness: 0.9 },
      },
      properties: {
        solid: true,
        transparent: false,
        emissive: 0,
        roughness: 0.5,
        metallic: 0,
      },
    }
  );

  useEffect(() => {
    if (selectedBlock) {
      setBlock({ ...selectedBlock });
    }
    // Load custom blocks
    const loaded = loadCustomBlocks();
    setCustomBlocks(loaded);
  }, [selectedBlock]);

  const handleSave = () => {
    if (!block.id || !block.name || !block.textures) {
      alert('Please fill in all required fields (Name is required)');
      return;
    }
    
    // Validate block ID is unique (if editing existing)
    const existing = loadCustomBlocks();
    const existingBlock = existing.find((b) => b.id === block.id && b.id !== selectedBlock?.id);
    if (existingBlock) {
      alert(`Block with ID "${block.id}" already exists. Please choose a different name.`);
      return;
    }

    const blockDef: BlockDefinition = {
      id: block.id,
      name: block.name,
      category: block.category || 'basic',
      material: block.material || 'plastic',
      textures: block.textures,
      properties: block.properties || {
        solid: true,
        transparent: false,
        emissive: 0,
        roughness: 0.5,
        metallic: 0,
      },
      ...(block.ctm && { ctm: block.ctm }),
    };

    // Save to localStorage
    const customBlocks = loadCustomBlocks();
    const existingIndex = customBlocks.findIndex((b) => b.id === blockDef.id);
    
    if (existingIndex >= 0) {
      customBlocks[existingIndex] = blockDef;
    } else {
      customBlocks.push(blockDef);
    }
    
    localStorage.setItem('customBlocks', JSON.stringify(customBlocks));
    onBlockChange(blockDef);
  };

  const loadCustomBlocks = (): BlockDefinition[] => {
    try {
      const data = localStorage.getItem('customBlocks');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!confirm(`Delete block "${blockId}"?`)) return;
    
    const updated = customBlocks.filter((b) => b.id !== blockId);
    localStorage.setItem('customBlocks', JSON.stringify(updated));
    setCustomBlocks(updated);
    
    if (block.id === blockId) {
      setBlock({
        id: '',
        name: '',
        category: 'basic',
        material: 'plastic',
        textures: {
          top: { color: [0.5, 0.5, 0.5, 1], pattern: 'smooth', brightness: 1.0 },
          bottom: { color: [0.5, 0.5, 0.5, 1], pattern: 'smooth', brightness: 0.8 },
          sides: { color: [0.5, 0.5, 0.5, 1], pattern: 'smooth', brightness: 0.9 },
        },
        properties: {
          solid: true,
          transparent: false,
          emissive: 0,
          roughness: 0.5,
          metallic: 0,
        },
      });
    }
  };

  const handleExportBlock = (block: BlockDefinition) => {
    const dataStr = JSON.stringify(block, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${block.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBlock = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string) as BlockDefinition;
          const updated = [...customBlocks, imported];
          localStorage.setItem('customBlocks', JSON.stringify(updated));
          setCustomBlocks(updated);
          setBlock(imported);
          onBlockChange(imported);
        } catch (error) {
          alert('Failed to import block: Invalid JSON');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="block-editor">
      <div className="editor-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>📦 Custom Blocks</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleImportBlock} className="import-button" style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
              📥 Import
            </button>
            <button onClick={() => setShowBlockList(!showBlockList)} className="import-button" style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
              {showBlockList ? '▼' : '▲'} List
            </button>
          </div>
        </div>
        
        {showBlockList && (
          <div className="custom-blocks-list" style={{ marginBottom: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
            {customBlocks.length === 0 ? (
              <p className="empty-state">No custom blocks yet</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {customBlocks.map((b) => (
                  <li key={b.id} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '0.5rem',
                    background: block.id === b.id ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '4px',
                    marginBottom: '0.25rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setBlock({ ...b });
                    onBlockChange(b);
                  }}
                  >
                    <span>{b.name}</span>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportBlock(b);
                        }}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#667eea' }}
                      >
                        📤
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBlock(b.id);
                        }}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#ff5f56' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="editor-section">
        <h3>📋 Basic Info</h3>
        <div className="form-group">
          <label>Name:</label>
          <input
            type="text"
            value={block.name || ''}
            onChange={(e) => {
              const name = e.target.value;
              setBlock({
                ...block,
                name,
                id: name.toLowerCase().replace(/\s+/g, '_'),
              });
            }}
            placeholder="Block name"
          />
        </div>
        <div className="form-group">
          <label>Category:</label>
          <select
            value={block.category || 'basic'}
            onChange={(e) => setBlock({ ...block, category: e.target.value as BlockCategory })}
          >
            <option value="basic">Basic</option>
            <option value="natural">Natural</option>
            <option value="gameplay">Gameplay</option>
          </select>
        </div>
        <div className="form-group">
          <label>Material:</label>
          <select
            value={block.material || 'plastic'}
            onChange={(e) => setBlock({ ...block, material: e.target.value as BlockMaterialType })}
          >
            <option value="solid">Solid</option>
            <option value="glass">Glass</option>
            <option value="metal">Metal</option>
            <option value="wood">Wood</option>
            <option value="stone">Stone</option>
            <option value="plastic">Plastic</option>
            <option value="emissive">Emissive</option>
          </select>
        </div>
      </div>

      <div className="editor-section">
        <h3>🎨 Textures</h3>
        {(['top', 'bottom', 'sides'] as const).map((face) => (
          <div key={face} className="face-editor">
            <h4>{face.charAt(0).toUpperCase() + face.slice(1)} Face</h4>
            <div className="form-group">
              <label>Color:</label>
              <input
                type="color"
                value={rgbaToHex(block.textures?.[face]?.color || [0.5, 0.5, 0.5, 1])}
                onChange={(e) => {
                  const rgb = hexToRgba(e.target.value);
                  setBlock({
                    ...block,
                    textures: {
                      ...block.textures!,
                      [face]: {
                        ...block.textures![face],
                        color: [rgb[0], rgb[1], rgb[2], block.textures![face]?.color[3] || 1],
                      },
                    },
                  });
                }}
              />
            </div>
            <div className="form-group">
              <label>Pattern:</label>
              <select
                value={block.textures?.[face]?.pattern || 'smooth'}
                onChange={(e) => {
                  setBlock({
                    ...block,
                    textures: {
                      ...block.textures!,
                      [face]: {
                        ...block.textures![face],
                        pattern: e.target.value as any,
                      },
                    },
                  });
                }}
              >
                <option value="solid">Solid</option>
                <option value="smooth">Smooth</option>
                <option value="grid">Grid</option>
                <option value="noise">Noise</option>
                <option value="bricks">Bricks</option>
                <option value="planks">Planks</option>
                <option value="cobble">Cobble</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="editor-section">
        <h3>⚙️ Properties</h3>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={block.properties?.solid || false}
              onChange={(e) =>
                setBlock({
                  ...block,
                  properties: { ...block.properties!, solid: e.target.checked },
                })
              }
            />
            Solid (Collision)
          </label>
        </div>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={block.properties?.transparent || false}
              onChange={(e) =>
                setBlock({
                  ...block,
                  properties: { ...block.properties!, transparent: e.target.checked },
                })
              }
            />
            Transparent
          </label>
        </div>
        <div className="form-group">
          <label>Emissive: {block.properties?.emissive || 0}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={block.properties?.emissive || 0}
            onChange={(e) =>
              setBlock({
                ...block,
                properties: { ...block.properties!, emissive: parseFloat(e.target.value) },
              })
            }
          />
        </div>
        <div className="form-group">
          <label>Roughness: {block.properties?.roughness || 0.5}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={block.properties?.roughness || 0.5}
            onChange={(e) =>
              setBlock({
                ...block,
                properties: { ...block.properties!, roughness: parseFloat(e.target.value) },
              })
            }
          />
        </div>
        <div className="form-group">
          <label>Metallic: {block.properties?.metallic || 0}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={block.properties?.metallic || 0}
            onChange={(e) =>
              setBlock({
                ...block,
                properties: { ...block.properties!, metallic: parseFloat(e.target.value) },
              })
            }
          />
        </div>
      </div>

      <div className="editor-actions">
        <button className="save-button" onClick={handleSave}>
          💾 Save Block
        </button>
      </div>
    </div>
  );
}

function rgbaToHex(rgba: RgbaColor): string {
  const r = Math.round(rgba[0] * 255).toString(16).padStart(2, '0');
  const g = Math.round(rgba[1] * 255).toString(16).padStart(2, '0');
  const b = Math.round(rgba[2] * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function hexToRgba(hex: string): RgbaColor {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b, 1];
}

