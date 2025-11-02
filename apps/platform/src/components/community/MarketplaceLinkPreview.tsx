import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/Button';
import { apiClient } from '../../api/client';

interface MarketplacePreview {
  id: string;
  title: string;
  description?: string;
  authorName?: string;
  thumbnailUrl?: string;
  type: 'build' | 'avatar';
  tags: string[];
  createdAt: number;
}

interface MarketplaceLinkPreviewProps {
  itemId: string;
}

export function MarketplaceLinkPreview({ itemId }: MarketplaceLinkPreviewProps) {
  const [preview, setPreview] = useState<MarketplacePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.get<MarketplacePreview>(`/api/forum/preview-marketplace/${itemId}`);
        if (!cancelled) {
          setPreview(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load preview');
          console.error('Failed to load marketplace preview:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [itemId]);

  if (loading) {
    return (
      <div style={{
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-3)',
        background: 'var(--bg-button)',
        margin: 'var(--spacing-2) 0',
      }}>
        <div style={{ color: 'var(--text-2)', fontSize: 'var(--text-sm)' }}>Loading preview...</div>
      </div>
    );
  }

  if (error || !preview) {
    return null;
  }

  return (
    <div style={{
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--spacing-3)',
      background: 'var(--bg-button)',
      margin: 'var(--spacing-2) 0',
      display: 'flex',
      gap: 'var(--spacing-3)',
    }}>
      {preview.thumbnailUrl && (
        <div style={{
          width: '120px',
          height: '80px',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          flexShrink: 0,
          background: 'var(--color-base-200)',
        }}>
          <img
            src={preview.thumbnailUrl.startsWith('http') || preview.thumbnailUrl.startsWith('/api') ? preview.thumbnailUrl : `/api${preview.thumbnailUrl}`}
            alt={preview.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{ margin: 0, marginBottom: 'var(--spacing-1)', fontSize: 'var(--text-base)', fontWeight: 'var(--font-medium)' }}>
          {preview.title}
        </h4>
        {preview.description && (
          <p style={{
            margin: 0,
            marginBottom: 'var(--spacing-2)',
            color: 'var(--text-2)',
            fontSize: 'var(--text-sm)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {preview.description}
          </p>
        )}
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          {preview.authorName && (
            <span style={{ color: 'var(--text-2)', fontSize: 'var(--text-xs)' }}>
              by {preview.authorName}
            </span>
          )}
          <span style={{ color: 'var(--text-2)', fontSize: 'var(--text-xs)' }}>
            {preview.type === 'build' ? '🎮 Build' : '👤 Avatar'}
          </span>
          <Link to={`/marketplace/${preview.id}`}>
            <Button variant="secondary" style={{ fontSize: 'var(--text-xs)', padding: 'var(--spacing-1) var(--spacing-2)' }}>
              View in Marketplace
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
