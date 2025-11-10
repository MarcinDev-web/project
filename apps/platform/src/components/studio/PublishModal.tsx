import { useState } from 'react';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import './PublishModal.css';

interface PublishModalProps {
  title: string;
  defaultTitle: string;
  defaultDescription?: string;
  defaultTags?: string[];
  onPublish: (data: { title: string; description?: string; tags?: string[] }) => Promise<void>;
  onCancel: () => void;
}

export function PublishModal({
  title: modalTitle,
  defaultTitle,
  defaultDescription = '',
  defaultTags = [],
  onPublish,
  onCancel,
}: PublishModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [tagsInput, setTagsInput] = useState(defaultTags.join(', '));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Tytuł jest wymagany');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await onPublish({
        title: title.trim(),
        description: description.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się opublikować projektu');
      setLoading(false);
    }
  };

  return (
    <div className="publish-modal-overlay" onClick={onCancel}>
      <Card className="publish-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="publish-modal-title">{modalTitle}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="publish-modal-field">
            <label htmlFor="publish-title" className="publish-modal-label">
              Tytuł <span className="required">*</span>
            </label>
            <input
              id="publish-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nazwa twojego projektu"
              maxLength={200}
              required
              className="publish-modal-input"
              disabled={loading}
            />
            <span className="publish-modal-hint">{title.length}/200 znaków</span>
          </div>

          <div className="publish-modal-field">
            <label htmlFor="publish-description" className="publish-modal-label">
              Opis
            </label>
            <textarea
              id="publish-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opisz swój projekt (opcjonalnie)"
              rows={4}
              maxLength={1000}
              className="publish-modal-textarea"
              disabled={loading}
            />
            <span className="publish-modal-hint">{description.length}/1000 znaków</span>
          </div>

          <div className="publish-modal-field">
            <label htmlFor="publish-tags" className="publish-modal-label">
              Tagi
            </label>
            <input
              id="publish-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="building, castle, medieval (oddzielone przecinkami)"
              className="publish-modal-input"
              disabled={loading}
            />
            <span className="publish-modal-hint">
              Oddziel tagi przecinkami. Pomagają użytkownikom znaleźć twój projekt.
            </span>
          </div>

          {error && (
            <div className="publish-modal-error">
              {error}
            </div>
          )}

          <div className="publish-modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !title.trim()}
            >
              {loading ? 'Publikowanie...' : 'Opublikuj'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

