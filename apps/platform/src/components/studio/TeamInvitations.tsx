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
        <p>{isOwner ? 'Brak zaproszeń' : 'Brak oczekujących zaproszeń'}</p>
      </Card>
    );
  }

  return (
    <div className="team-invitations-list">
      {allInvitations.map((invitation) => {
        const isForMe = invitation.inviteeUserId === currentUserId;
        const isExpired = invitation.expiresAt < Date.now();
        const canAccept = isForMe && invitation.status === 'pending' && !isExpired;

        return (
          <Card key={invitation.id} hoverable={false}>
            <div className="invitation-item">
              <div className="invitation-info">
                <div className="invitation-header">
                  <strong>
                    {invitation.inviteeUsername ||
                      invitation.inviteeEmail ||
                      invitation.inviteeUserId ||
                      'Nieznany użytkownik'}
                  </strong>
                </div>
                <div className="invitation-meta">
                  <span className={`invitation-status status-${invitation.status}`}>
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
                    {new Date(invitation.createdAt).toLocaleDateString('pl-PL')}
                  </span>
                  {invitation.status === 'pending' && !isExpired && (
                    <span className="invitation-expires">
                      Wygasa: {new Date(invitation.expiresAt).toLocaleDateString('pl-PL')}
                    </span>
                  )}
                </div>
              </div>
              <div className="invitation-actions">
                {canAccept && (
                  <>
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
                  </>
                )}
                {!canAccept && invitation.status === 'pending' && (
                  <span className="invitation-note">Oczekuje na odpowiedź</span>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

