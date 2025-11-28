/**
 * CommunitySidebar - Left panel with friends list
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { friendsApi, type Friend } from '../../api/friends';
import { useAuth } from '../../contexts/AuthContext';
import { useWebSocket, type WebSocketMessage } from '../../hooks/useWebSocket';

interface CommunitySidebarProps {
  onFriendClick: (friendId: string) => void;
  onConversationClick: (conversationId: string) => void;
  friendRequestsCount: number;
  onCountsUpdate: () => void;
}

export function CommunitySidebar({ 
  onFriendClick, 
  friendRequestsCount,
  onCountsUpdate
}: CommunitySidebarProps) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [showRequests, setShowRequests] = useState(false);

  // WebSocket for real-time updates
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    if (message.type === 'presence:online') {
      setOnlineUsers(prev => new Set(prev).add(message.userId));
    } else if (message.type === 'presence:offline') {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(message.userId);
        return next;
      });
    } else if (message.type === 'friend:request') {
      loadFriendRequests();
      onCountsUpdate();
    }
  };

  useWebSocket(handleWebSocketMessage, true);

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadFriends(),
        loadFriendRequests(),
        loadPresence(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      const data = await friendsApi.getFriends();
      const validFriends = data.filter(friend => {
        if (!friend) return false;
        return friend.id && (friend.email || friend.username || friend.displayName);
      });
      setFriends(validFriends);
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const data = await friendsApi.getRequests();
      const pending = data.filter(r => r.status === 'pending');
      setFriendRequests(pending);
    } catch (error) {
      console.error('Failed to load friend requests:', error);
    }
  };

  const loadPresence = async () => {
    try {
      const presence = await friendsApi.getPresence();
      const online = Object.entries(presence)
        .filter(([_, isOnline]) => isOnline)
        .map(([userId]) => userId);
      setOnlineUsers(new Set(online));
    } catch (error) {
      console.error('Failed to load presence:', error);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await friendsApi.acceptRequest(requestId);
      await loadData();
      onCountsUpdate();
    } catch (error) {
      console.error('Failed to accept request:', error);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await friendsApi.declineRequest(requestId);
      await loadFriendRequests();
      onCountsUpdate();
    } catch (error) {
      console.error('Failed to decline request:', error);
    }
  };

  const onlineFriends = friends.filter(f => onlineUsers.has(f.id));
  const offlineFriends = friends.filter(f => !onlineUsers.has(f.id));

  if (!user) {
    return (
      <div className="community-sidebar">
        <div className="community-sidebar__login-prompt">
          <p>Log in to see your friends</p>
          <Link to="/login" className="community-sidebar__login-btn">Log In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="community-sidebar">
      {/* Header */}
      <div className="community-sidebar__header">
        <h3 className="community-sidebar__title">
          👥 Friends
          {friendRequestsCount > 0 && (
            <span className="community-sidebar__badge">{friendRequestsCount}</span>
          )}
        </h3>
      </div>

      <div className="community-sidebar__section">
        {/* Friend Requests */}
        {friendRequests.length > 0 && (
          <div className="community-sidebar__requests">
            <button 
              className="community-sidebar__requests-toggle"
              onClick={() => setShowRequests(!showRequests)}
            >
              <span>🔔 Friend Requests ({friendRequests.length})</span>
              <span className="community-sidebar__toggle-icon">{showRequests ? '▼' : '▶'}</span>
            </button>
            
            {showRequests && (
              <div className="community-sidebar__requests-list">
                {friendRequests.map(request => (
                  <div key={request.id} className="community-sidebar__request">
                    <div className="community-sidebar__request-info">
                      <span className="community-sidebar__request-name">
                        User {request.fromUserId.substring(0, 8)}
                      </span>
                    </div>
                    <div className="community-sidebar__request-actions">
                      <button 
                        className="community-sidebar__request-btn community-sidebar__request-btn--accept"
                        onClick={() => handleAcceptRequest(request.id)}
                        title="Accept"
                      >
                        ✓
                      </button>
                      <button 
                        className="community-sidebar__request-btn community-sidebar__request-btn--decline"
                        onClick={() => handleDeclineRequest(request.id)}
                        title="Decline"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Online friends */}
        {onlineFriends.length > 0 && (
          <div className="community-sidebar__group">
            <h4 className="community-sidebar__group-title">
              <span className="community-sidebar__online-dot" />
              Online ({onlineFriends.length})
            </h4>
            <div className="community-sidebar__list">
              {onlineFriends.map(friend => (
                <button
                  key={friend.id}
                  className="community-sidebar__user"
                  onClick={() => onFriendClick(friend.id)}
                  title="Click to message"
                >
                  <div className="community-sidebar__avatar">
                    {friend.avatarUrl ? (
                      <img src={friend.avatarUrl} alt="" />
                    ) : (
                      <span>{(friend.displayName ?? friend.username ?? friend.email ?? '?').charAt(0).toUpperCase()}</span>
                    )}
                    <span className="community-sidebar__status community-sidebar__status--online" />
                  </div>
                  <span className="community-sidebar__name">
                    {friend.displayName ?? friend.username ?? friend.email ?? `User ${friend.id.substring(0, 8)}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Offline friends */}
        {offlineFriends.length > 0 && (
          <div className="community-sidebar__group">
            <h4 className="community-sidebar__group-title">
              Offline ({offlineFriends.length})
            </h4>
            <div className="community-sidebar__list">
              {offlineFriends.slice(0, 10).map(friend => (
                <button
                  key={friend.id}
                  className="community-sidebar__user community-sidebar__user--offline"
                  onClick={() => onFriendClick(friend.id)}
                  title="Click to message"
                >
                  <div className="community-sidebar__avatar">
                    {friend.avatarUrl ? (
                      <img src={friend.avatarUrl} alt="" />
                    ) : (
                      <span>{(friend.displayName ?? friend.username ?? friend.email ?? '?').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <span className="community-sidebar__name">
                    {friend.displayName ?? friend.username ?? friend.email ?? `User ${friend.id.substring(0, 8)}`}
                  </span>
                </button>
              ))}
              {offlineFriends.length > 10 && (
                <div className="community-sidebar__more">
                  +{offlineFriends.length - 10} more
                </div>
              )}
            </div>
          </div>
        )}

        {friends.length === 0 && !loading && (
          <div className="community-sidebar__empty">
            <p>No friends yet</p>
            <Link to="/community-hub?discover=friends" className="community-sidebar__find-btn">
              Find Friends
            </Link>
          </div>
        )}

        {loading && (
          <div className="community-sidebar__loading">
            Loading...
          </div>
        )}
      </div>
    </div>
  );
}

