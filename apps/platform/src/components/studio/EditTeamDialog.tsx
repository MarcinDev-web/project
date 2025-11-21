import { useState, useEffect } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { studioApi } from '../../api/studio';
import '../../styles/studio.css';

interface EditTeamDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  teamId: string;
  initialName: string;
  initialDescription?: string;
}

export function EditTeamDialog({
  isOpen,
  onClose,
  onUpdate,
  teamId,
  initialName,
  initialDescription = '',
}: EditTeamDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription || '');
    }
  }, [isOpen, initialName, initialDescription]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('Nazwa ekipy jest wymagana');
      return;
    }

    try {
      setLoading(true);
      await studioApi.updateTeam(teamId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Failed to update team:', error);
      alert('Nie udało się zaktualizować ekipy');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="project-editor-overlay" onClick={onClose}>
      <Card className="project-editor-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="project-editor-title">Edytuj Ekipę</h2>

        <div className="project-editor-form">
          <div className="form-group">
            <label htmlFor="edit-team-name">Nazwa ekipy *</label>
            <input
              id="edit-team-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Moja Ekipa"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-team-description">Opis</label>
            <textarea
              id="edit-team-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opis ekipy..."
              rows={4}
              disabled={loading}
            />
          </div>
        </div>

        <div className="project-editor-actions">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Anuluj
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
          >
            {loading ? 'Zapisywanie...' : 'Zapisz'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
