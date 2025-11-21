import { useState, useEffect } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { TeamMembersList } from './TeamMembersList';
import { TeamInvitations } from './TeamInvitations';
import { InviteMemberDialog } from './InviteMemberDialog';
import { EditTeamDialog } from './EditTeamDialog';
import { studioApi, type StudioTeam, type TeamMember, type TeamInvitation } from '../../api/studio';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/studio.css';

export function TeamManagement() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [team, setTeam] = useState<StudioTeam | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [teamData, membersData, invitationsData] = await Promise.all([
        studioApi.getTeam().catch(() => null),
        studioApi.getTeamMembers().catch(() => ({ members: [] })),
        studioApi.getInvitations().catch(() => ({ invitations: [] })),
      ]);

      setTeam(teamData);
      setMembers(membersData.members);
      setInvitations(invitationsData.invitations);
    } catch (error) {
      console.error('Failed to load team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      alert('Nazwa ekipy jest wymagana');
      return;
    }

    try {
      const newTeam = await studioApi.createTeam({
        name: teamName.trim(),
        description: teamDescription.trim() || undefined,
      });
      setTeam(newTeam);
      setShowCreateDialog(false);
      setTeamName('');
      setTeamDescription('');
      showToast('Ekipa utworzona!', 'success');
      void loadData();
    } catch (error) {
      console.error('Failed to create team:', error);
      showToast(
        error instanceof Error && error.message.includes('already exists')
          ? 'Ekipa już istnieje dla tego studia'
          : 'Nie udało się utworzyć ekipy',
        'error'
      );
    }
  };

  const handleInvite = async () => {
    void loadData();
    showToast('Zaproszenie wysłane', 'success');
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      await studioApi.updateInvitation(invitationId, 'accept');
      showToast('Zaproszenie zaakceptowane!', 'success');
      void loadData();
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      showToast('Nie udało się zaakceptować zaproszenia', 'error');
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      await studioApi.updateInvitation(invitationId, 'decline');
      showToast('Zaproszenie odrzucone', 'success');
      void loadData();
    } catch (error) {
      console.error('Failed to decline invitation:', error);
      showToast('Nie udało się odrzucić zaproszenia', 'error');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tego członka z ekipy?')) {
      return;
    }

    try {
      await studioApi.removeMember(userId);
      showToast('Członek usunięty', 'success');
      void loadData();
    } catch (error) {
      console.error('Failed to remove member:', error);
      showToast('Nie udało się usunąć członka', 'error');
    }
  };

  const handleLeaveTeam = async () => {
    if (!user) return;
    
    if (!window.confirm('Czy na pewno chcesz opuścić ekipę? Utracisz dostęp do współdzielonych projektów.')) {
      return;
    }

    try {
      await studioApi.removeMember(user.id);
      showToast('Opuściłeś ekipę', 'success');
      setTeam(null);
      setMembers([]);
      setInvitations([]);
      // Refresh to show empty state or whatever is appropriate
      void loadData();
    } catch (error) {
      console.error('Failed to leave team:', error);
      showToast('Nie udało się opuścić ekipy', 'error');
    }
  };

  const handleTeamUpdate = () => {
    showToast('Ekipa zaktualizowana', 'success');
    void loadData();
  };

  const isOwner = team && user && team.studioOwnerId === user.id;

  const getTeamInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <Card>
        <div className="studio-loading">
          <p>Ładowanie ekipy...</p>
        </div>
      </Card>
    );
  }

  if (!team) {
    return (
      <div className="team-setup">
        <Card>
          <div className="empty-team-state">
             <div className="empty-team-icon">🚀</div>
             <h2>Utwórz Ekipę</h2>
             <p>Zaproś użytkowników do współpracy w swoim studio gier!</p>

            {!showCreateDialog ? (
              <Button variant="primary" onClick={() => setShowCreateDialog(true)}>
                Utwórz Ekipę
              </Button>
            ) : (
              <div className="create-team-form">
                <div className="form-group">
                  <label htmlFor="team-name">Nazwa ekipy *</label>
                  <input
                    id="team-name"
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Moja Ekipa"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="team-description">Opis (opcjonalnie)</label>
                  <textarea
                    id="team-description"
                    value={teamDescription}
                    onChange={(e) => setTeamDescription(e.target.value)}
                    placeholder="Opisz swoją ekipę..."
                    rows={3}
                  />
                </div>
                <div className="project-editor-actions">
                  <Button variant="secondary" onClick={() => setShowCreateDialog(false)}>
                    Anuluj
                  </Button>
                  <Button variant="primary" onClick={handleCreateTeam} disabled={!teamName.trim()}>
                    Utwórz
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="team-management">
      <div className="team-banner">
         <div className="team-banner-content">
            <div className="team-avatar-large">
               {getTeamInitials(team.name)}
            </div>
            <div className="team-info-large">
               <h2>{team.name}</h2>
               {team.description && <p className="team-description">{team.description}</p>}
               <div className="team-stats-badges">
                  <span className="team-badge">
                    👥 {members.length} Członków
                  </span>
                  <span className="team-badge">
                    📅 Utworzono {new Date().getFullYear()}
                  </span>
               </div>
            </div>
            <div className="team-actions-large">
              {isOwner ? (
                <>
                  <Button variant="secondary" onClick={() => setShowEditDialog(true)} style={{ marginRight: '8px' }}>
                    Edytuj
                  </Button>
                  <Button variant="primary" onClick={() => setShowInviteDialog(true)}>
                    + Zaproś
                  </Button>
                </>
              ) : (
                <Button variant="danger" onClick={handleLeaveTeam}>
                  Opuść Ekipę
                </Button>
              )}
            </div>
         </div>
      </div>

      <div className="team-content-grid">
        <div className="team-section-main">
          <div className="section-header">
            <h3>Członkowie Ekipy</h3>
            <span className="count-badge">{members.length}</span>
          </div>
          <TeamMembersList
            members={members}
            currentUserId={user?.id || ''}
            isOwner={!!isOwner}
            onRemoveMember={isOwner ? handleRemoveMember : undefined}
          />
        </div>

        <div className="team-section-side">
          <div className="section-header">
            <h3>Zaproszenia</h3>
            {invitations.length > 0 && <span className="count-badge">{invitations.length}</span>}
          </div>
          <TeamInvitations
            invitations={invitations}
            currentUserId={user?.id || ''}
            isOwner={!!isOwner}
            onAccept={handleAcceptInvitation}
            onDecline={handleDeclineInvitation}
          />
        </div>
      </div>

      {showInviteDialog && (
        <InviteMemberDialog
          isOpen={showInviteDialog}
          onClose={() => setShowInviteDialog(false)}
          onInvite={handleInvite}
        />
      )}

      {showEditDialog && (
        <EditTeamDialog
          isOpen={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          onUpdate={handleTeamUpdate}
          teamId={team.id}
          initialName={team.name}
          initialDescription={team.description}
        />
      )}
    </div>
  );
}
