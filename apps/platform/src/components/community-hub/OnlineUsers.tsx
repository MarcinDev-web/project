import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWebSocket, type WebSocketMessage } from '../../hooks/useWebSocket';

interface OnlineUser {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  status: 'online' | 'away' | 'dnd';
  activity?: string;
}

interface OnlineUsersProps {
  maxVisible?: number;
}

// Mock data - replace with API call
const mockOnlineUsers: OnlineUser[] = [
  { id: '1', username: 'ProGamer99', displayName: 'Pro Gamer', status: 'online', activity: 'Browsing Showcase' },
  { id: '2', username: 'BuildMaster', displayName: 'Build Master', status: 'online', activity: 'Creating a thread' },
  { id: '3', username: 'CreativeKing', displayName: 'Creative King', status: 'away' },
  { id: '4', username: 'HelperHero', displayName: 'Helper Hero', status: 'online', activity: 'In Help & Support' },
  { id: '5', username: 'NewBuilder', displayName: 'New Builder', status: 'online' },
  { id: '6', username: 'ArtistPro', displayName: 'Artist Pro', status: 'dnd', activity: 'Working on project' },
  { id: '7', username: 'GameDev101', displayName: 'Game Dev', status: 'online' },
  { id: '8', username: 'ScriptWiz', displayName: 'Script Wiz', status: 'online', activity: 'Reading tutorials' },
];

export function OnlineUsers({ maxVisible = 6 }: OnlineUsersProps) {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [totalOnline, setTotalOnline] = useState(0);

  useEffect(() => {
    // Simulate API call
    setUsers(mockOnlineUsers.slice(0, maxVisible));
    setTotalOnline(mockOnlineUsers.length + Math.floor(Math.random() * 50));
  }, [maxVisible]);

  // Listen for presence updates
  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'presence:online') {
      setTotalOnline(prev => prev + 1);
    }
    if (message.type === 'presence:offline') {
      setTotalOnline(prev => Math.max(0, prev - 1));
    }
  }, []);

  useWebSocket(handleMessage, true);

  const getStatusColor = (status: OnlineUser['status']) => {
    switch (status) {
      case 'online': return 'var(--forum-online-color)';
      case 'away': return 'var(--forum-neon-gold)';
      case 'dnd': return 'var(--forum-neon-red)';
      default: return 'var(--text-3)';
    }
  };

  const remainingCount = totalOnline - users.length;

  return (
    <div className="forum-gaming-panel forum-online-users">
      <div className="forum-gaming-panel__header">
        <span className="forum-gaming-panel__icon">👥</span>
        <h3 className="forum-gaming-panel__title">Online Now</h3>
        <span className="forum-online-users__count">
          <span className="forum-online-users__count-dot" />
          {totalOnline}
        </span>
      </div>

      <div className="forum-gaming-panel__content">
        <div className="forum-online-users__list">
          {users.map((user, index) => (
            <Link
              key={user.id}
              to={`/profile/${user.username}`}
              className="forum-online-users__user"
              style={{ '--item-index': index } as React.CSSProperties}
            >
              <div className="forum-online-users__avatar">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.displayName} />
                ) : (
                  <span>{user.displayName.charAt(0)}</span>
                )}
                <span 
                  className="forum-online-users__status"
                  style={{ background: getStatusColor(user.status) }}
                />
              </div>
              <div className="forum-online-users__info">
                <span className="forum-online-users__name">{user.displayName}</span>
                {user.activity && (
                  <span className="forum-online-users__activity">{user.activity}</span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {remainingCount > 0 && (
          <div className="forum-online-users__more">
            <span className="forum-online-users__more-avatars">
              {[...Array(Math.min(3, remainingCount))].map((_, i) => (
                <span key={i} className="forum-online-users__more-avatar">+</span>
              ))}
            </span>
            <span className="forum-online-users__more-text">
              +{remainingCount} more online
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

