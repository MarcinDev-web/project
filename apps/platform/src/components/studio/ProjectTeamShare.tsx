import { useState, useEffect } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { studioApi, type ProjectTeamAccess, type TeamMember, type ShareProjectRequest } from '../../api/studio';
import '../../styles/studio.css';

interface ProjectTeamShareProps {
  projectId: string;
  members: TeamMember[];
  currentAccess?: ProjectTeamAccess | null;
  onAccessChanged?: () => void;
}

export function ProjectTeamShare({
  projectId,
  members,
  currentAccess,
  onAccessChanged,
}: ProjectTeamShareProps) {
  const [accessLevel, setAccessLevel] = useState<'read' | 'write'>(
    currentAccess?.accessLevel || 'read'
  );
  const [assignedUserId, setAssignedUserId] = useState<string>(
    currentAccess?.userId || ''
  );
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(!!currentAccess);

  useEffect(() => {
    if (currentAccess) {
      setAccessLevel(currentAccess.accessLevel);
      setAssignedUserId(currentAccess.userId || '');
      setSharing(true);
    }
  }, [currentAccess]);

  const handleShare = async () => {
    try {
      setLoading(true);
      const request: ShareProjectRequest = {
        accessLevel,
        ...(assignedUserId && { userId: assignedUserId }),
      };

      await studioApi.shareProjectWithTeam(projectId, request);
      setSharing(true);
      onAccessChanged?.();
    } catch (error) {
      console.error('Failed to share project:', error);
      alert(error instanceof Error ? error.message : 'Nie udało się udostępnić projektu');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAccess = async () => {
    if (!window.confirm('Czy na pewno chcesz usunąć dostęp ekipy do tego projektu?')) {
      return;
    }

    try {
      setLoading(true);
      await studioApi.removeProjectTeamAccess(projectId);
      setSharing(false);
      onAccessChanged?.();
    } catch (error) {
      console.error('Failed to remove access:', error);
      alert(error instanceof Error ? error.message : 'Nie udało się usunąć dostępu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>Udostępnij Projekt Ekipie</h3>

      {sharing ? (
        <div className="project-share-current">
          <p>
            Projekt jest udostępniony ekipie z poziomem dostępu:{' '}
            <strong>{accessLevel === 'read' ? 'Tylko odczyt' : 'Edycja'}</strong>
          </p>
          {currentAccess?.userId && (
            <p>
              Przypisany do:{' '}
              <strong>
                {members.find((m) => m.userId === currentAccess.userId)?.userName ||
                  currentAccess.userId}
              </strong>
            </p>
          )}
          <div className="project-share-actions">
            <Button variant="secondary" onClick={handleRemoveAccess} disabled={loading}>
              Usuń dostęp
            </Button>
          </div>
        </div>
      ) : (
        <div className="project-share-form">
          <div className="form-group">
            <label htmlFor="access-level">Poziom dostępu:</label>
            <select
              id="access-level"
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value as 'read' | 'write')}
              disabled={loading}
            >
              <option value="read">Tylko odczyt</option>
              <option value="write">Edycja</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="assign-member">Przypisz do członka (opcjonalnie):</label>
            <select
              id="assign-member"
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
              disabled={loading}
            >
              <option value="">Wszyscy członkowie</option>
              {members
                .filter((m) => m.role === 'member')
                .map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.userName || member.userEmail || member.userId}
                  </option>
                ))}
            </select>
            <p className="form-hint">
              Jeśli przypiszesz projekt do konkretnego członka, tylko on będzie mógł go edytować.
              W przeciwnym razie wszyscy członkowie z odpowiednim poziomem dostępu będą mogli go
              edytować.
            </p>
          </div>

          <div className="project-share-actions">
            <Button variant="primary" onClick={handleShare} disabled={loading}>
              {loading ? 'Udostępnianie...' : 'Udostępnij'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

