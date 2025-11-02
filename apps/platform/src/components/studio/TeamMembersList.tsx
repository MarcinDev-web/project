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
        <p>Brak członków w ekipie</p>
      </Card>
    );
  }

  return (
    <div className="team-members-list">
      <table className="team-members-table">
        <thead>
          <tr>
            <th>Użytkownik</th>
            <th>Rola</th>
            <th>Dołączył</th>
            {isOwner && <th>Akcje</th>}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const isCurrentUser = member.userId === currentUserId;
            const canRemove = isOwner && !isCurrentUser && member.role !== 'owner';

            return (
              <tr key={member.userId} className={isCurrentUser ? 'current-user' : ''}>
                <td>
                  <div className="member-info">
                    <strong>{member.userName || member.userEmail || member.userId}</strong>
                    {member.userEmail && member.userName && (
                      <span className="member-email">{member.userEmail}</span>
                    )}
                  </div>
                </td>
                <td>
                  <span className={`member-role role-${member.role}`}>
                    {member.role === 'owner' ? '👑 Właściciel' : '👤 Członek'}
                  </span>
                </td>
                <td>{new Date(member.joinedAt).toLocaleDateString('pl-PL')}</td>
                {isOwner && (
                  <td>
                    {canRemove && onRemoveMember && (
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => onRemoveMember(member.userId)}
                      >
                        Usuń
                      </Button>
                    )}
                    {!canRemove && <span className="no-action">-</span>}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

