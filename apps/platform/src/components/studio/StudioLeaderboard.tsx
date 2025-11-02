import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../shared/Card';
import { studioApi, type LeaderboardResponse } from '../../api/studio';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import '../../styles/studio.css';

export function StudioLeaderboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<'views' | 'downloads' | 'likes' | 'projects'>('views');
  const [period, setPeriod] = useState<'all' | 'week' | 'month'>('all');

  useEffect(() => {
    void loadLeaderboard();
  }, [metric, period]);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      const data = await studioApi.getLeaderboard({ metric, period, limit: 100 });
      setLeaderboard(data);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      showToast('Nie udało się załadować rankingu', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="studio-loading">
          <p>Ładowanie rankingu...</p>
        </div>
      </Card>
    );
  }

  if (!leaderboard) {
    return (
      <Card>
        <p>Brak danych rankingu</p>
      </Card>
    );
  }

  const currentUserRank = leaderboard.leaderboard.findIndex((entry) => entry.userId === user?.id) + 1;

  return (
    <div className="leaderboard-container">
      <Card>
        <div className="leaderboard-header">
          <h2>Ranking Studii</h2>
          <div className="leaderboard-filters">
            <div className="filter-group">
              <label>Metryka:</label>
              <select value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)}>
                <option value="views">Wyświetlenia</option>
                <option value="downloads">Pobrania</option>
                <option value="likes">Polubienia</option>
                <option value="projects">Projekty</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Okres:</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>
                <option value="all">Wszystko</option>
                <option value="week">Tydzień</option>
                <option value="month">Miesiąc</option>
              </select>
            </div>
          </div>
        </div>

        {currentUserRank > 0 && currentUserRank <= 10 && (
          <div className="leaderboard-user-highlight">
            <p>
              🎉 Gratulacje! Jesteś na miejscu <strong>#{currentUserRank}</strong> w rankingu!
            </p>
          </div>
        )}

        {currentUserRank > 10 && (
          <div className="leaderboard-user-info">
            <p>
              Twoja pozycja: <strong>#{currentUserRank}</strong>
            </p>
          </div>
        )}

        <div className="leaderboard-list">
          {leaderboard.leaderboard.length === 0 ? (
            <p>Brak danych w rankingu</p>
          ) : (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Pozycja</th>
                  <th>Studio</th>
                  <th>Wyświetlenia</th>
                  <th>Pobrania</th>
                  <th>Polubienia</th>
                  <th>Projekty</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.leaderboard.map((entry) => {
                  const isCurrentUser = entry.userId === user?.id;
                  return (
                    <tr
                      key={entry.userId}
                      className={isCurrentUser ? 'current-user' : ''}
                    >
                      <td className="rank-cell">
                        {entry.rank <= 3 && (
                          <span className="medal">
                            {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                          </span>
                        )}
                        <strong>#{entry.rank}</strong>
                      </td>
                      <td>
                        <Link to={`/profile/${entry.userId}`} className="leaderboard-user-link">
                          {entry.userName || entry.userId}
                        </Link>
                      </td>
                      <td>{entry.views.toLocaleString()}</td>
                      <td>{entry.downloads.toLocaleString()}</td>
                      <td>{entry.likes.toLocaleString()}</td>
                      <td>{entry.projects}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

