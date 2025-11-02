import { useState } from 'react';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import { apiClient } from '../../api/client';
import { useNavigate } from 'react-router-dom';

interface ShareToCommunityProps {
  projectToken: string;
  onClose?: () => void;
  initialTitle?: string;
  initialDescription?: string;
}

/**
 * Component for sharing a project to the forum
 * Can be used from editor or project manager
 */
export function ShareToCommunity({ 
  projectToken, 
  onClose,
  initialTitle = '',
  initialDescription = '',
}: ShareToCommunityProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const categoryId = 'cat_showcase';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiClient.post<{ id: string }>('/api/forum/share-project', {
        projectToken,
        categoryId,
        title: title.trim(),
        description: description.trim() || undefined,
      });

      // Navigate to the created thread
      navigate(`/community/thread/${response.id}`);
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share project');
      console.error('Failed to share project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card style={{ padding: 'var(--spacing-4)', maxWidth: '500px' }}>
      <h2 style={{ marginTop: 0, marginBottom: 'var(--spacing-4)' }}>Share to Community</h2>
      
      {error && (
        <div style={{
          padding: 'var(--spacing-2)',
          background: 'var(--color-error)',
          color: 'white',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 'var(--spacing-3)',
          fontSize: 'var(--text-sm)',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
        <div>
          <label style={{ 
            display: 'block', 
            marginBottom: 'var(--spacing-1)', 
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
          }}>
            Thread Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter thread title"
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              background: 'var(--bg-button)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-1)',
              fontSize: 'var(--text-sm)',
            }}
          />
        </div>

        <div>
          <label style={{ 
            display: 'block', 
            marginBottom: 'var(--spacing-1)', 
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
          }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your project..."
            rows={4}
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              background: 'var(--bg-button)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-1)',
              fontSize: 'var(--text-sm)',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
          {onClose && (
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={!title.trim() || isSubmitting}>
            {isSubmitting ? 'Sharing...' : 'Share to Forum'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
