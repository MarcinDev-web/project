import { useState, useEffect } from 'react';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import type { StudioProject, UpdateStudioProjectRequest } from '../../api/studio';
import '../../styles/studio.css';

interface ProjectEditorProps {
  project?: StudioProject | null;
  onSave: (updates: UpdateStudioProjectRequest) => Promise<void>;
  onCancel: () => void;
  isOpen: boolean;
}

export function ProjectEditor({ project, onSave, onCancel, isOpen }: ProjectEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      setTags(project.tags || []);
      setTagsInput((project.tags || []).join(', '));
    } else {
      setName('');
      setDescription('');
      setTags([]);
      setTagsInput('');
    }
  }, [project, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Nazwa projektu jest wymagana');
      return;
    }

    setSaving(true);
    try {
      const updates: UpdateStudioProjectRequest = {
        name: name.trim(),
        ...(description.trim() && { description: description.trim() }),
        ...(tags.length > 0 && { tags }),
      };
      await onSave(updates);
    } catch (error) {
      console.error('Failed to save project:', error);
      alert('Nie udało się zapisać projektu');
    } finally {
      setSaving(false);
    }
  };

  const handleTagsInputChange = (value: string) => {
    setTagsInput(value);
    const parsedTags = value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    setTags(parsedTags);
  };

  return (
    <div className="project-editor-overlay" onClick={onCancel}>
      <Card className="project-editor-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="project-editor-title">
          {project ? 'Edytuj Projekt' : 'Nowy Projekt'}
        </h2>

        <div className="project-editor-form">
          <div className="form-group">
            <label htmlFor="project-name">Nazwa projektu *</label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Moja gra"
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="project-description">Opis</label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opisz swój projekt..."
              rows={4}
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="project-tags">Tagi (oddzielone przecinkami)</label>
            <input
              id="project-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => handleTagsInputChange(e.target.value)}
              placeholder="gra, adventure, 3d"
              disabled={saving}
            />
            {tags.length > 0 && (
              <div className="tags-preview">
                {tags.map((tag, index) => (
                  <span key={index} className="tag-preview">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="project-editor-actions">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Anuluj
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Zapisywanie...' : 'Zapisz'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

