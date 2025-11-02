import { useState } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { studioApi, type StudioComparison as StudioComparisonType } from '../../api/studio';
import { useToast } from '../../contexts/ToastContext';
import '../../styles/studio.css';

interface StudioComparisonProps {
  userId?: string;
  onClose?: () => void;
}

export function StudioComparison({ userId, onClose }: StudioComparisonProps) {
  const { showToast } = useToast();
  const [comparisonUserId, setComparisonUserId] = useState(userId || '');
  const [comparison, setComparison] = useState<StudioComparisonType | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    if (!comparisonUserId.trim()) {
      showToast('Wprowadź ID użytkownika do porównania', 'error');
      return;
    }

    try {
      setLoading(true);
      const data = await studioApi.compareStudio(comparisonUserId.trim());
      setComparison(data);
    } catch (error) {
      console.error('Failed to compare studios:', error);
      showToast('Nie udało się porównać studiów', 'error');
      setComparison(null);
    } finally {
      setLoading(false);
    }
  };

  if (!comparison) {
    return (
      <Card>
        <div className="comparison-form">
          <h2>Porównaj Studio</h2>
          <div className="form-group">
            <label htmlFor="compare-user-id">ID użytkownika do porównania</label>
            <input
              id="compare-user-id"
              type="text"
              value={comparisonUserId}
              onChange={(e) => setComparisonUserId(e.target.value)}
              placeholder="user_123..."
            />
          </div>
          <div className="comparison-actions">
            {onClose && (
              <Button variant="secondary" onClick={onClose}>
                Anuluj
              </Button>
            )}
            <Button variant="primary" onClick={handleCompare} disabled={loading || !comparisonUserId.trim()}>
              {loading ? 'Porównywanie...' : 'Porównaj'}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const current = comparison.currentUser;
  const compared = comparison.comparedUser;

  return (
    <Card>
      <div className="comparison-results">
        <div className="comparison-header">
          <h2>Porównanie Studiów</h2>
          <Button variant="secondary" onClick={() => setComparison(null)}>
            Nowe porównanie
          </Button>
        </div>

        <div className="comparison-grid">
          <div className="comparison-column">
            <h3>Twoje Studio</h3>
            <div className="comparison-stats">
              <div className="comparison-stat">
                <span>Projekty:</span>
                <strong>{current.totalProjects}</strong>
              </div>
              <div className="comparison-stat">
                <span>Opublikowane:</span>
                <strong>{current.publishedProjects}</strong>
              </div>
              <div className="comparison-stat">
                <span>Wyświetlenia:</span>
                <strong>{current.totalViews.toLocaleString()}</strong>
              </div>
              <div className="comparison-stat">
                <span>Pobrania:</span>
                <strong>{current.totalDownloads.toLocaleString()}</strong>
              </div>
              <div className="comparison-stat">
                <span>Polubienia:</span>
                <strong>{current.totalLikes.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          <div className="comparison-column">
            <h3>Studio użytkownika {compared.userId}</h3>
            <div className="comparison-stats">
              <div className="comparison-stat">
                <span>Projekty:</span>
                <strong>{compared.totalProjects}</strong>
                {compared.totalProjects > current.totalProjects && <span className="comparison-better">↑</span>}
                {compared.totalProjects < current.totalProjects && <span className="comparison-worse">↓</span>}
              </div>
              <div className="comparison-stat">
                <span>Opublikowane:</span>
                <strong>{compared.publishedProjects}</strong>
                {compared.publishedProjects > current.publishedProjects && (
                  <span className="comparison-better">↑</span>
                )}
                {compared.publishedProjects < current.publishedProjects && (
                  <span className="comparison-worse">↓</span>
                )}
              </div>
              <div className="comparison-stat">
                <span>Wyświetlenia:</span>
                <strong>{compared.totalViews.toLocaleString()}</strong>
                {compared.totalViews > current.totalViews && <span className="comparison-better">↑</span>}
                {compared.totalViews < current.totalViews && <span className="comparison-worse">↓</span>}
              </div>
              <div className="comparison-stat">
                <span>Pobrania:</span>
                <strong>{compared.totalDownloads.toLocaleString()}</strong>
                {compared.totalDownloads > current.totalDownloads && <span className="comparison-better">↑</span>}
                {compared.totalDownloads < current.totalDownloads && <span className="comparison-worse">↓</span>}
              </div>
              <div className="comparison-stat">
                <span>Polubienia:</span>
                <strong>{compared.totalLikes.toLocaleString()}</strong>
                {compared.totalLikes > current.totalLikes && <span className="comparison-better">↑</span>}
                {compared.totalLikes < current.totalLikes && <span className="comparison-worse">↓</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

