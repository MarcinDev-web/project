import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import type { TeamInvitation } from '../../api/studio';
import '../../styles/studio.css';

interface TeamInvitationsProps {
  invitations: TeamInvitation[];
  currentUserId: string;
  isOwner: boolean;
  onAccept?: (invitationId: string) => void;
  onDecline?: (invitationId: string) => void;
  loading?: boolean;
}

export function TeamInvitations({
  invitations,
  currentUserId,
  isOwner,
  onAccept,
  onDecline,
  loading,
}: TeamInvitationsProps) {
  if (loading) {
    return (
      <Card>
        <div className="studio-loading">
          <p>Ładowanie zaproszeń...</p>
        </div>
      </Card>
    );
  }

  const pendingForMe = invitations.filter(
    (inv) => inv.status === 'pending' && inv.inviteeUserId === currentUserId
  );
  const allInvitations = isOwner ? invitations : pendingForMe;

  if (allInvitations.length === 0) {
    return (
      <Card>
        <div className="studio-empty-state">
          <p>{isOwner ? 'Brak zaproszeń' : 'Brak oczekujących zaproszeń'}</p>
        </div>
      </Card>
    );
  }

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  const getDisplayName = (invitation: TeamInvitation) => {
    return invitation.inviteeUsername || 
           invitation.inviteeEmail?.split('@')[0] || 
           invitation.inviteeUserId || 
           'Nieznany';
  };

  return (
    <div className="team-invitations-grid">
      {allInvitations.map((invitation) => {
        const isForMe = invitation.inviteeUserId === currentUserId;
        const isExpired = invitation.expiresAt < Date.now();
        const canAccept = isForMe && invitation.status === 'pending' && !isExpired;
        const displayName = getDisplayName(invitation);
        const initials = getInitials(displayName);

        return (
          <div key={invitation.id} className="invitation-card">
            <div className="invitation-avatar">
              {initials}
            </div>
            
            <div className="invitation-content">
              <div className="invitation-main-info">
                <span className="invitation-name">{displayName}</span>
                {invitation.inviteeEmail && invitation.inviteeEmail !== displayName && (
                  <span className="invitation-email">{invitation.inviteeEmail}</span>
                )}
              </div>

              <div className="invitation-details">
                <span className={`status-badge status-${invitation.status}`}>
                  {invitation.status === 'pending' && isExpired
                    ? '⏰ Wygasło'
                    : invitation.status === 'pending'
                      ? '⏳ Oczekujące'
                      : invitation.status === 'accepted'
                        ? '✅ Zaakceptowane'
                        : invitation.status === 'declined'
                          ? '❌ Odrzucone'
                          : '⏰ Wygasło'}
                </span>
                <span className="invitation-date">
                   Wysłano: {new Date(invitation.createdAt).toLocaleDateString('pl-PL')}
                </span>
              </div>
            </div>

            <div className="invitation-actions-area">
              {canAccept ? (
                <div className="action-buttons">
                  {onAccept && (
                    <Button
                      variant="primary"
                      size="small"
                      onClick={() => onAccept(invitation.id)}
                    >
                      Zaakceptuj
                    </Button>
                  )}
                  {onDecline && (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => onDecline(invitation.id)}
                    >
                      Odrzuć
                    </Button>
                  )}
                </div>
              ) : (
                invitation.status === 'pending' && (
                  <span className="invitation-note">Oczekuje na odpowiedź</span>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
