import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import type { TeamMember } from '../../api/studio';
import '../../styles/studio.css';

interface TeamMembersListProps {
  members: TeamMember[];
  currentUserId: string;
  isOwner: boolean;
  onRemoveMember?: (userId: string) => void;
  loading?: boolean;
}

export function TeamMembersList({
  members,
  currentUserId,
  isOwner,
  onRemoveMember,
  loading,
}: TeamMembersListProps) {
  if (loading) {
    return (
      <Card>
        <div className="studio-loading">
          <p>Ładowanie członków...</p>
        </div>
      </Card>
    );
  }

  if (members.length === 0) {
    return (
      <Card>
        <div className="studio-empty-state">
          <p>Brak członków w ekipie</p>
        </div>
      </Card>
    );
  }

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  const getDisplayName = (member: TeamMember) => {
    return member.userName || member.userEmail.split('@')[0] || 'Użytkownik';
  };

  return (
    <div className="team-members-grid">
      {members.map((member) => {
        const isCurrentUser = member.userId === currentUserId;
        const canRemove = isOwner && !isCurrentUser && member.role !== 'owner';
        const displayName = getDisplayName(member);
        const initials = getInitials(displayName);

        return (
          <div 
            key={member.userId} 
            className={`team-member-card ${isCurrentUser ? 'current-user' : ''}`}
          >
            <div className="member-avatar">
              {initials}
            </div>
            
            <div className="member-details">
              <div className="member-header">
                <span className="member-name" title={displayName}>
                  {displayName}
                </span>
                {isCurrentUser && <span className="badge badge-you">Ty</span>}
              </div>
              
              <div className="member-meta">
                <span className={`member-role-badge role-${member.role}`}>
                  {member.role === 'owner' ? '👑 Właściciel' : '👤 Członek'}
                </span>
                <span className="member-date">
                  {new Date(member.joinedAt).toLocaleDateString('pl-PL')}
                </span>
              </div>
              
              {member.userEmail && member.userEmail !== displayName && (
                 <div className="member-email-text" title={member.userEmail}>
                   {member.userEmail}
                 </div>
              )}
            </div>

            {isOwner && (
              <div className="member-actions">
                {canRemove && onRemoveMember ? (
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => onRemoveMember(member.userId)}
                    className="btn-icon-only"
                    title="Usuń z ekipy"
                  >
                    ✕
                  </Button>
                ) : (
                  <div className="action-placeholder"></div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
