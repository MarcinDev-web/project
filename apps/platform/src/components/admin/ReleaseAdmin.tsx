/**
 * Release Admin Component
 * UI for managing releases and semantic versioning
 */

import { useState, useEffect } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { adminApi, type Release } from '../../api/admin';

export interface ReleaseStats {
  total: number;
  byType: {
    major: number;
    minor: number;
    patch: number;
  };
  lastRelease?: {
    tag: string;
    version: string;
    createdAt: number;
  };
  currentVersion: string;
}

export function ReleaseAdmin() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [stats, setStats] = useState<ReleaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedVersionType, setSelectedVersionType] = useState<'major' | 'minor' | 'patch'>('patch');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    void loadReleases();
    void loadStats();
  }, []);

  const loadReleases = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getReleases();
      setReleases(response.releases);
    } catch (error) {
      console.error('Failed to load releases:', error);
      alert('Failed to load releases');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await adminApi.getReleaseStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load release stats:', error);
    }
  };

  const handleCreateRelease = async () => {
    setCreating(true);
    try {
      await adminApi.createRelease(selectedVersionType);
      setShowCreateModal(false);
      alert('Release workflow started successfully. Check GitHub Actions for progress.');
      // Refresh after a delay to allow workflow to start
      setTimeout(() => {
        void loadReleases();
        void loadStats();
      }, 2000);
    } catch (error) {
      console.error('Failed to create release:', error);
      alert('Failed to create release. Check console for details.');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: Release['status']) => {
    switch (status) {
      case 'success':
        return '#10b981';
      case 'failed':
        return '#ef4444';
      case 'running':
        return '#3b82f6';
      case 'pending':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getStatusLabel = (status: Release['status']) => {
    switch (status) {
      case 'success':
        return 'Sukces';
      case 'failed':
        return 'Błąd';
      case 'running':
        return 'W trakcie';
      case 'pending':
        return 'Oczekuje';
      default:
        return status;
    }
  };

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <Card>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #666)', marginBottom: '0.5rem' }}>
              Aktualna wersja
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.currentVersion}</div>
          </Card>
          <Card>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #666)', marginBottom: '0.5rem' }}>
              Łącznie release'ów
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.total}</div>
          </Card>
          {stats.lastRelease && (
            <Card>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #666)', marginBottom: '0.5rem' }}>
                Ostatni release
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{stats.lastRelease.tag}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #666)' }}>
                {formatDate(stats.lastRelease.createdAt)}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Actions */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>Zarządzanie Release'ami</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary, #666)', fontSize: '0.875rem' }}>
              Twórz nowe release'y z automatycznym versioning i changelog
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            style={{ minWidth: '150px' }}
          >
            🚀 Nowy Release
          </Button>
        </div>
      </Card>

      {/* Create Release Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !creating && setShowCreateModal(false)}
        >
          <Card
            style={{
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Utwórz Nowy Release</h2>
            <p style={{ color: 'var(--text-secondary, #666)', marginBottom: '1.5rem' }}>
              Wybierz typ wersji zgodnie z Semantic Versioning:
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.75rem', borderRadius: '8px', border: selectedVersionType === 'major' ? '2px solid #3b82f6' : '2px solid transparent', backgroundColor: selectedVersionType === 'major' ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                  <input
                    type="radio"
                    name="versionType"
                    value="major"
                    checked={selectedVersionType === 'major'}
                    onChange={(e) => setSelectedVersionType(e.target.value as 'major')}
                    style={{ cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Major (np. 1.0.0 → 2.0.0)</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                      Breaking changes - zmiany niekompatybilne wstecz
                    </div>
                  </div>
                </label>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.75rem', borderRadius: '8px', border: selectedVersionType === 'minor' ? '2px solid #3b82f6' : '2px solid transparent', backgroundColor: selectedVersionType === 'minor' ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                  <input
                    type="radio"
                    name="versionType"
                    value="minor"
                    checked={selectedVersionType === 'minor'}
                    onChange={(e) => setSelectedVersionType(e.target.value as 'minor')}
                    style={{ cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Minor (np. 1.0.0 → 1.1.0)</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                      Nowe funkcje - kompatybilne wstecz
                    </div>
                  </div>
                </label>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.75rem', borderRadius: '8px', border: selectedVersionType === 'patch' ? '2px solid #3b82f6' : '2px solid transparent', backgroundColor: selectedVersionType === 'patch' ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                  <input
                    type="radio"
                    name="versionType"
                    value="patch"
                    checked={selectedVersionType === 'patch'}
                    onChange={(e) => setSelectedVersionType(e.target.value as 'patch')}
                    style={{ cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Patch (np. 1.0.0 → 1.0.1)</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                      Poprawki błędów - kompatybilne wstecz
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                variant="secondary"
              >
                Anuluj
              </Button>
              <Button
                onClick={handleCreateRelease}
                disabled={creating}
              >
                {creating ? 'Tworzenie...' : 'Utwórz Release'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Releases List */}
      <Card>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Historia Release'ów</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary, #666)' }}>
            Ładowanie...
          </div>
        ) : releases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary, #666)' }}>
            Brak release'ów. Utwórz pierwszy release!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color, #e5e7eb)' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: 'bold' }}>Tag</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: 'bold' }}>Wersja</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: 'bold' }}>Typ</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: 'bold' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: 'bold' }}>Data</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: 'bold' }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((release) => (
                  <tr key={release.id} style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <code style={{ backgroundColor: 'var(--bg-secondary, #f3f4f6)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.875rem' }}>
                        {release.tag}
                      </code>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{release.version}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          backgroundColor:
                            release.type === 'major'
                              ? '#fee2e2'
                              : release.type === 'minor'
                                ? '#dbeafe'
                                : '#dcfce7',
                          color:
                            release.type === 'major'
                              ? '#991b1b'
                              : release.type === 'minor'
                                ? '#1e40af'
                                : '#166534',
                        }}
                      >
                        {release.type}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          backgroundColor: getStatusColor(release.status) + '20',
                          color: getStatusColor(release.status),
                        }}
                      >
                        {getStatusLabel(release.status)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                      {formatDate(release.createdAt)}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {release.githubReleaseUrl && (
                          <a
                            href={release.githubReleaseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#3b82f6',
                              textDecoration: 'none',
                              fontSize: '0.875rem',
                            }}
                          >
                            GitHub →
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

