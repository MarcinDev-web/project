import { Card } from '../shared/Card';
import type { StudioStats as StudioStatsType } from '../../api/studio';
import '../../styles/studio.css';

interface StudioStatsProps {
  stats: StudioStatsType | null;
  loading?: boolean;
}

export function StudioStats({ stats, loading }: StudioStatsProps) {
  if (loading) {
    return (
      <Card>
        <div className="studio-loading">
          <p>Ładowanie statystyk...</p>
        </div>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <p>Brak statystyk do wyświetlenia</p>
      </Card>
    );
  }

  return (
    <div className="studio-stats-details">
      <Card>
        <h2>Szczegółowe Statystyki</h2>
        <div className="stats-details">
          <div className="stats-row">
            <span>Wszystkie projekty:</span>
            <strong>{stats.totalProjects}</strong>
          </div>
          <div className="stats-row">
            <span>Opublikowane:</span>
            <strong>{stats.publishedProjects}</strong>
          </div>
          <div className="stats-row">
            <span>Wersje robocze:</span>
            <strong>{stats.totalProjects - stats.publishedProjects}</strong>
          </div>
          <div className="stats-row">
            <span>Łączne wyświetlenia:</span>
            <strong>{stats.totalViews.toLocaleString()}</strong>
          </div>
          <div className="stats-row">
            <span>Łączne pobrania:</span>
            <strong>{stats.totalDownloads.toLocaleString()}</strong>
          </div>
          <div className="stats-row">
            <span>Łączne polubienia:</span>
            <strong>{stats.totalLikes.toLocaleString()}</strong>
          </div>
          {stats.studioRank && (
            <div className="stats-row highlight">
              <span>Pozycja w rankingu:</span>
              <strong>#{stats.studioRank}</strong>
            </div>
          )}
          {stats.totalProjects > 0 && (
            <>
              <div className="stats-row">
                <span>Średnie wyświetlenia na projekt:</span>
                <strong>{Math.round(stats.totalViews / stats.totalProjects).toLocaleString()}</strong>
              </div>
              <div className="stats-row">
                <span>Średnie polubienia na projekt:</span>
                <strong>{Math.round(stats.totalLikes / stats.totalProjects).toLocaleString()}</strong>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

