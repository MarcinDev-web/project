import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/Button';
import { friendsApi, type Friend } from '../../api/friends';
import { useAuth } from '../../contexts/AuthContext';

export function FriendsTab() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [suggestions, setSuggestions] = useState<Array<Friend & { mutualFriends?: number }>>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'friends' | 'suggestions' | 'requests'>('friends');
  const [searchTerm, setSearchTerm] = useState('');

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
      const [friendsData, suggestionsData, requestsData] = await Promise.all([
        friendsApi.getFriends().catch(err => {
          console.error('Error loading friends:', err);
          return [];
        }),
        friendsApi.getSuggestions().catch(() => []),
        friendsApi.getRequests().catch(err => {
          console.error('Error loading friend requests:', err);
          return [];
        }),
      ]);
      
      // Validate and filter out invalid friends
      const validFriends = friendsData.filter(friend => {
        if (!friend) return false;
        const hasId = friend.id && typeof friend.id === 'string';
        const hasIdentifier = friend.email || friend.username || friend.displayName;
        return hasId && hasIdentifier;
      });
      
      const validSuggestions = suggestionsData.filter(suggestion => {
        if (!suggestion) return false;
        const hasId = suggestion.id && typeof suggestion.id === 'string';
        const hasIdentifier = suggestion.email || suggestion.username || suggestion.displayName;
        return hasId && hasIdentifier;
      });
      
      setFriends(validFriends);
      setSuggestions(validSuggestions);
      setFriendRequests(Array.isArray(requestsData) ? requestsData.filter(r => r.status === 'pending') : []);
    } catch (error) {
      console.error('Failed to load friends data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await friendsApi.acceptRequest(requestId);
      await loadData();
    } catch (error) {
      console.error('Failed to accept request:', error);
      alert('Failed to accept friend request');
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await friendsApi.declineRequest(requestId);
      await loadData();
    } catch (error) {
      console.error('Failed to decline request:', error);
      alert('Failed to decline friend request');
    }
  };

  const handleSendRequest = async (toUserId: string) => {
    try {
      await friendsApi.sendRequest(toUserId);
      await loadData();
    } catch (error) {
      console.error('Failed to send request:', error);
      alert('Failed to send friend request');
    }
  };

  const filterUsers = (users: any[]) => {
    if (!searchTerm) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(u => 
      (u.displayName?.toLowerCase().includes(term)) || 
      (u.username?.toLowerCase().includes(term)) || 
      (u.email?.toLowerCase().includes(term))
    );
  };

  if (loading) {
    return (
      <div className="page-container">Loading...</div>
    );
  }

  const filteredFriends = filterUsers(friends);
  const filteredSuggestions = filterUsers(suggestions);

  return (
    <div>
      {/* Toolbar */}
      <div className="friends-toolbar">
        <div className="friends-tabs">
          <button
            onClick={() => setActiveTab('friends')}
            className={`friends-tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`friends-tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`}
          >
            Find Friends
          </button>
          {friendRequests.length > 0 && (
            <button
              onClick={() => setActiveTab('requests')}
              className={`friends-tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
            >
              Requests ({friendRequests.length})
            </button>
          )}
        </div>
        
        <div className="friends-search">
          <input
            type="text"
            className="forge-input"
            placeholder="Search people..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Friends Tab */}
      {activeTab === 'friends' && (
        <>
          {filteredFriends.length === 0 ? (
            <div className="shop-empty-state">
              <p>
                {searchTerm 
                  ? `No friends found matching "${searchTerm}"` 
                  : 'No friends yet. Check out the "Find Friends" tab to discover people!'}
              </p>
            </div>
          ) : (
            <div className="friends-grid">
              {filteredFriends.map(friend => (
                <div key={friend.id} className="friend-card">
                  <div className="friend-header">
                    <div className="friend-avatar" style={{
                      backgroundImage: friend.avatarUrl ? `url(${friend.avatarUrl})` : undefined
                    }}>
                      {!friend.avatarUrl && ((friend.displayName ?? friend.username ?? friend.email ?? '?').charAt(0).toUpperCase())}
                      <div className={`friend-status ${friend.isOnline ? 'online' : ''}`} />
                    </div>
                    <div className="friend-info">
                      <h3 className="friend-name">
                        {friend.displayName ?? friend.username ?? friend.email ?? `User ${friend.id.substring(0, 8)}`}
                      </h3>
                      <p className="friend-meta">
                        {friend.isOnline ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </div>
                  <div className="friend-actions">
                    <Link to={`/profile/${friend.id}`} style={{ flex: 1 }}>
                      <Button variant="secondary" style={{ width: '100%' }}>View Profile</Button>
                    </Link>
                    <Link to={`/community-hub?tab=messages&user=${friend.id}`} style={{ flex: 1 }}>
                      <Button variant="primary" style={{ width: '100%' }}>Message</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Suggestions Tab */}
      {activeTab === 'suggestions' && (
        <>
          {filteredSuggestions.length === 0 ? (
            <div className="shop-empty-state">
              <p>
                {searchTerm 
                  ? `No people found matching "${searchTerm}"` 
                  : 'No suggestions available.'}
              </p>
            </div>
          ) : (
            <div className="friends-grid">
              {filteredSuggestions.map(suggestion => (
                <div key={suggestion.id} className="friend-card">
                  <div className="friend-header">
                    <div className="friend-avatar" style={{
                      backgroundImage: suggestion.avatarUrl ? `url(${suggestion.avatarUrl})` : undefined
                    }}>
                      {!suggestion.avatarUrl && ((suggestion.displayName ?? suggestion.email ?? suggestion.username ?? '?').charAt(0).toUpperCase())}
                      {suggestion.isOnline && <div className="friend-status online" />}
                    </div>
                    <div className="friend-info">
                      <h3 className="friend-name">
                        {suggestion.displayName ?? suggestion.username ?? suggestion.email ?? `User ${suggestion.id.substring(0, 8)}`}
                      </h3>
                      {suggestion.mutualFriends !== undefined && suggestion.mutualFriends > 0 && (
                        <p className="friend-meta">
                          {suggestion.mutualFriends} mutual friend{suggestion.mutualFriends !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="friend-actions">
                    <Link to={`/profile/${suggestion.id}`} style={{ flex: 1 }}>
                      <Button variant="secondary" style={{ width: '100%' }}>View Profile</Button>
                    </Link>
                    <Button
                      variant="primary"
                      style={{ flex: 1 }}
                      onClick={() => handleSendRequest(suggestion.id)}
                    >
                      Add Friend
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <>
          {friendRequests.length === 0 ? (
            <div className="shop-empty-state">
              <p>No pending friend requests</p>
            </div>
          ) : (
            <div className="friends-grid">
              {friendRequests.map(request => (
                <div key={request.id} className="friend-card">
                  <div className="friend-header">
                    <div className="friend-avatar">
                      ?
                    </div>
                    <div className="friend-info">
                      <h3 className="friend-name">User {request.fromUserId.substring(0, 8)}</h3>
                      <p className="friend-meta">
                        Sent {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="friend-actions">
                    <Button
                      variant="primary"
                      onClick={() => handleAcceptRequest(request.id)}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleDeclineRequest(request.id)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
