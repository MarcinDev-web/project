import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { studioApi, type AvatarPreset } from '../../api/studio';
import { useToast } from '../../contexts/ToastContext';
import { PublishModal } from './PublishModal';
import './AvatarsList.css';

interface AvatarsListProps {
  presets: AvatarPreset[];
  onDelete: (id: string) => void;
  onPublish: (preset: AvatarPreset) => void;
  loading?: boolean;
}

export function AvatarsList({ presets, onDelete, onPublish, loading }: AvatarsListProps) {
  if (loading) {
    return (
      <div className="avatars-loading">
        <p>Ładowanie avatar presets...</p>
      </div>
    );
  }

  if (presets.length === 0) {
    return (
      <div className="avatars-empty">
        <p>Brak avatar presets.</p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', marginTop: 'var(--spacing-2)' }}>
          Stwórz avatar preset w <a href="/avatar-builder" style={{ color: 'var(--color-accent-400)' }}>Avatar Builder</a> aby móc go opublikować.
        </p>
      </div>
    );
  }

  return (
    <div className="avatars-grid">
      {presets.map((preset) => (
        <AvatarCard key={preset.id} preset={preset} onDelete={onDelete} onPublish={onPublish} />
      ))}
    </div>
  );
}

interface AvatarCardProps {
  preset: AvatarPreset;
  onDelete: (id: string) => void;
  onPublish: (preset: AvatarPreset) => void;
}

function AvatarCard({ preset, onDelete, onPublish }: AvatarCardProps) {
  const { showToast } = useToast();

  const handleDelete = async () => {
    if (!window.confirm(`Czy na pewno chcesz usunąć preset "${preset.name}"?`)) {
      return;
    }

    try {
      await studioApi.deleteAvatarPreset(preset.id);
      onDelete(preset.id);
      showToast('Avatar preset usunięty', 'success');
    } catch (error) {
      console.error('Failed to delete avatar preset:', error);
      showToast('Nie udało się usunąć avatar preset', 'error');
    }
  };

  return (
    <Card className="avatar-card">
      {preset.thumbnailUrl && (
        <div className="avatar-card-thumbnail">
          <img src={preset.thumbnailUrl} alt={preset.name} />
        </div>
      )}
      <div className="avatar-card-content">
        <h3 className="avatar-card-title">{preset.name}</h3>
        {preset.description && <p className="avatar-card-description">{preset.description}</p>}
        {preset.tags.length > 0 && (
          <div className="avatar-card-tags">
            {preset.tags.map((tag) => (
              <span key={tag} className="avatar-card-tag">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="avatar-card-meta">
          <span className="avatar-card-date">
            {new Date(preset.updatedAt).toLocaleDateString('pl-PL')}
          </span>
          {preset.isPublished && (
            <span className="avatar-card-published">Opublikowany</span>
          )}
        </div>
      </div>
      <div className="avatar-card-actions">
        <Button
          variant="primary"
          onClick={() => onPublish(preset)}
          disabled={preset.isPublished}
        >
          {preset.isPublished ? 'Opublikowany' : 'Opublikuj'}
        </Button>
        <Button variant="secondary" onClick={handleDelete}>
          Usuń
        </Button>
      </div>
    </Card>
  );
}

