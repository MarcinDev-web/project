import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/Button';
import { apiClient } from '../../api/client';

interface ProjectPreview {
  token: string;
  title: string;
  createdAt: number;
}

interface ProjectLinkPreviewProps {
  projectToken: string;
}

export function ProjectLinkPreview({ projectToken }: ProjectLinkPreviewProps) {
  const [preview, setPreview] = useState<ProjectPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.get<ProjectPreview>(`/api/projects/${projectToken}/preview`);
        if (!cancelled) {
          setPreview(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load preview');
          console.error('Failed to load project preview:', err);
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
  }, [projectToken]);

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
      alignItems: 'center',
    }}>
      <div style={{
        width: '60px',
        height: '60px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--color-base-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        flexShrink: 0,
      }}>
        📁
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{ margin: 0, marginBottom: 'var(--spacing-1)', fontSize: 'var(--text-base)', fontWeight: 'var(--font-medium)' }}>
          {preview.title}
        </h4>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-2)', fontSize: 'var(--text-xs)' }}>
            Created {new Date(preview.createdAt).toLocaleDateString()}
          </span>
          <Link to={`/projects/${preview.token}`}>
            <Button variant="secondary" style={{ fontSize: 'var(--text-xs)', padding: 'var(--spacing-1) var(--spacing-2)' }}>
              Open in Editor
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
