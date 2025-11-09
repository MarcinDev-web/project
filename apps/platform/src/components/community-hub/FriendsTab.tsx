import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../shared/Card';
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
      console.log('Friends data loaded:', { 
        friends: friendsData, 
        friendsCount: friendsData.length,
        suggestions: suggestionsData, 
        suggestionsCount: suggestionsData.length,
        requests: requestsData, 
        requestsCount: requestsData.length
      });
      
      // Validate and filter out invalid friends
      const validFriends = friendsData.filter(friend => {
        if (!friend) {
          console.warn('Null or undefined friend:', friend);
          return false;
        }
        // Check if friend has required fields - id is required, and at least one of email/username
        const hasId = friend.id && typeof friend.id === 'string';
        const hasIdentifier = friend.email || friend.username || friend.displayName;
        const isValid = hasId && hasIdentifier;
        if (!isValid) {
          console.warn('Invalid friend data (missing id or identifier):', friend);
        }
        return isValid;
      });
      
      const validSuggestions = suggestionsData.filter(suggestion => {
        if (!suggestion) {
          console.warn('Null or undefined suggestion:', suggestion);
          return false;
        }
        const hasId = suggestion.id && typeof suggestion.id === 'string';
        const hasIdentifier = suggestion.email || suggestion.username || suggestion.displayName;
        const isValid = hasId && hasIdentifier;
        if (!isValid) {
          console.warn('Invalid suggestion data (missing id or identifier):', suggestion);
        }
        return isValid;
      });
      
      console.log('After validation:', {
        validFriendsCount: validFriends.length,
        validSuggestionsCount: validSuggestions.length,
        validFriends: validFriends.map(f => ({ id: f.id, email: f.email, username: f.username, displayName: f.displayName })),
        validSuggestions: validSuggestions.map(s => ({ id: s.id, email: s.email, username: s.username, displayName: s.displayName, mutualFriends: s.mutualFriends })),
      });
      
      setFriends(validFriends);
      setSuggestions(validSuggestions);
      setFriendRequests(Array.isArray(requestsData) ? requestsData.filter(r => r.status === 'pending') : []);
    } catch (error) {
      console.error('Failed to load friends data:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        status: (error as any)?.status,
        apiError: (error as any)?.apiError,
      });
      // Don't show alert - empty results are fine, errors are logged to console
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

  if (loading) {
    return (
      <div className="page-container">Loading...</div>
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-2)',
        marginBottom: 'var(--spacing-6)',
        borderBottom: '1px solid var(--border-default)',
      }}>
        <button
          onClick={() => setActiveTab('friends')}
          style={{
            padding: 'var(--spacing-2) var(--spacing-4)',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'friends' ? 'var(--text-1)' : 'var(--text-2)',
            borderBottom: activeTab === 'friends' ? '2px solid var(--bg-button-primary)' : '2px solid transparent',
            cursor: 'pointer',
          }}
        >
          Friends ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab('suggestions')}
          style={{
            padding: 'var(--spacing-2) var(--spacing-4)',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'suggestions' ? 'var(--text-1)' : 'var(--text-2)',
            borderBottom: activeTab === 'suggestions' ? '2px solid var(--bg-button-primary)' : '2px solid transparent',
            cursor: 'pointer',
          }}
        >
          Find Friends
        </button>
        {friendRequests.length > 0 && (
          <button
            onClick={() => setActiveTab('requests')}
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'requests' ? 'var(--text-1)' : 'var(--text-2)',
              borderBottom: activeTab === 'requests' ? '2px solid var(--bg-button-primary)' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            Requests ({friendRequests.length})
          </button>
        )}
      </div>

      {/* Friends Tab */}
      {activeTab === 'friends' && (
        <>
          {friends.length === 0 ? (
            <Card>
              <p style={{ color: 'var(--text-2)', textAlign: 'center', padding: 'var(--spacing-8)' }}>
                No friends yet. Check out the "Find Friends" tab to discover people!
              </p>
            </Card>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: 'var(--spacing-4)',
            }}>
              {friends.filter(friend => friend && friend.id).map(friend => (
                <Card key={friend.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
                    <div style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      background: friend.avatarUrl ? `url(${friend.avatarUrl}) center/cover` : 'var(--bg-button)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--text-lg)',
                      position: 'relative',
                    }}>
                      {!friend.avatarUrl && ((friend.displayName ?? friend.username ?? friend.email ?? '?').charAt(0).toUpperCase())}
                      {friend.isOnline && (
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: '#4ade80',
                          border: '2px solid var(--bg-panel)',
                        }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {friend.displayName ?? friend.username ?? friend.email ?? `User ${friend.id.substring(0, 8)}`}
                      </h3>
                      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-2)' }}>
                        {friend.isOnline ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                    <Link to={`/profile/${friend.id}`} style={{ flex: 1 }}>
                      <Button variant="secondary" style={{ width: '100%' }}>View Profile</Button>
                    </Link>
                    <Link to={`/community-hub?tab=messages&user=${friend.id}`} style={{ flex: 1 }}>
                      <Button variant="primary" style={{ width: '100%' }}>Message</Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Suggestions Tab */}
      {activeTab === 'suggestions' && (
        <>
          {suggestions.length === 0 ? (
            <Card>
              <p style={{ color: 'var(--text-2)', textAlign: 'center', padding: 'var(--spacing-8)' }}>
                No suggestions available. Add some friends first!
              </p>
            </Card>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: 'var(--spacing-4)',
            }}>
              {suggestions.filter(suggestion => suggestion && suggestion.id).map(suggestion => (
                <Card key={suggestion.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
                    <div style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      background: suggestion.avatarUrl ? `url(${suggestion.avatarUrl}) center/cover` : 'var(--bg-button)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--text-lg)',
                      position: 'relative',
                    }}>
                      {!suggestion.avatarUrl && ((suggestion.displayName ?? suggestion.email ?? suggestion.username ?? '?').charAt(0).toUpperCase())}
                      {suggestion.isOnline && (
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: '#4ade80',
                          border: '2px solid var(--bg-panel)',
                        }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {suggestion.displayName ?? suggestion.username ?? suggestion.email ?? `User ${suggestion.id.substring(0, 8)}`}
                      </h3>
                      {suggestion.mutualFriends !== undefined && suggestion.mutualFriends > 0 && (
                        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-2)' }}>
                          {suggestion.mutualFriends} mutual friend{suggestion.mutualFriends !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
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
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <>
          {friendRequests.length === 0 ? (
            <Card>
              <p style={{ color: 'var(--text-2)', textAlign: 'center', padding: 'var(--spacing-8)' }}>
                No pending friend requests
              </p>
            </Card>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-4)',
            }}>
              {friendRequests.map(request => (
                <Card key={request.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ margin: 0 }}>User {request.fromUserId.substring(0, 8)}</h3>
                      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
                        Sent {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
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
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

