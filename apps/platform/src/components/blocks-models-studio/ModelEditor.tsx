/**
 * ModelEditor - Editor for 3D models (GLTF/GLB import and editing)
 */

import { useState, useEffect } from 'react';

export interface ImportedModel {
  id: string;
  name: string;
  url: string;
  size: number;
  importedAt: number;
}

export interface ModelEditorProps {
  onModelSelect?: (model: ImportedModel | null) => void;
  onModelsChange?: (models: ImportedModel[]) => void;
}

/**
 * Model editor component for importing and editing 3D models
 */
export function ModelEditor(_props: ModelEditorProps) {
  const [importedModels, setImportedModels] = useState<ImportedModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<ImportedModel | null>(null);

  // Load saved models on mount
  useEffect(() => {
    const loadSavedModels = () => {
      try {
        const data = localStorage.getItem('importedModels');
        if (data) {
          setImportedModels(JSON.parse(data));
        }
      } catch {
        // Ignore errors
      }
    };
    loadSavedModels();
  }, []);

  const saveModels = (models: ImportedModel[]) => {
    localStorage.setItem('importedModels', JSON.stringify(models));
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.name.endsWith('.gltf') || file.name.endsWith('.glb')) {
        const reader = new FileReader();
        reader.onload = () => {
          const url = URL.createObjectURL(file);
          const newModel: ImportedModel = {
            id: `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            url,
            size: file.size,
            importedAt: Date.now(),
          };
          const updated = [...importedModels, newModel];
          setImportedModels(updated);
          saveModels(updated);
          _props.onModelsChange?.(updated);
        };
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const handleDeleteModel = (modelId: string) => {
    const model = importedModels.find((m) => m.id === modelId);
    if (model) {
      URL.revokeObjectURL(model.url);
    }
    const updated = importedModels.filter((m) => m.id !== modelId);
    setImportedModels(updated);
    saveModels(updated);
    if (selectedModel?.id === modelId) {
      setSelectedModel(null);
      _props.onModelSelect?.(null);
    }
    _props.onModelsChange?.(updated);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="model-editor">
      <div className="editor-section">
        <h3>🎨 Import Models</h3>
        <div className="form-group">
          <label>
            Import GLTF/GLB:
            <input
              type="file"
              accept=".gltf,.glb"
              multiple
              onChange={handleFileImport}
              style={{ display: 'none' }}
              id="model-file-input"
            />
          </label>
          <button
            onClick={() => document.getElementById('model-file-input')?.click()}
            className="import-button"
          >
            📁 Choose Files
          </button>
        </div>
      </div>

      <div className="editor-section">
        <h3>📦 Imported Models</h3>
        {importedModels.length === 0 ? (
          <p className="empty-state">No models imported yet</p>
        ) : (
          <ul className="model-list">
            {importedModels.map((model) => (
              <li 
                key={model.id} 
                className={`model-item ${selectedModel?.id === model.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedModel(model);
                  _props.onModelSelect?.(model);
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500' }}>{model.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                    {formatFileSize(model.size)}
                  </div>
                </div>
                <button 
                  className="delete-button" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteModel(model.id);
                  }}
                  title="Delete model"
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedModel && (
        <div className="editor-section">
          <h3>⚙️ Model Properties</h3>
          <div className="form-group">
            <label>Model Name:</label>
            <input
              type="text"
              value={selectedModel.name}
              onChange={(e) => {
                const updated = importedModels.map((m) =>
                  m.id === selectedModel.id ? { ...m, name: e.target.value } : m
                );
                setImportedModels(updated);
                setSelectedModel({ ...selectedModel, name: e.target.value });
                saveModels(updated);
                _props.onModelsChange?.(updated);
                _props.onModelSelect?.({ ...selectedModel, name: e.target.value });
              }}
            />
          </div>
          <div className="form-group">
            <label>Scale:</label>
            <input type="range" min="0.1" max="5" step="0.1" defaultValue="1" />
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" defaultChecked />
              Cast Shadows
            </label>
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" defaultChecked />
              Receive Shadows
            </label>
          </div>
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              💡 Drag this model to viewport to place it in the scene
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

