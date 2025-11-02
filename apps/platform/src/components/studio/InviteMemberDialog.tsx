import { useState, useEffect } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { studioApi, type InviteMemberRequest } from '../../api/studio';
import { friendsApi } from '../../api/friends';
import type { PublicUser } from '@shared/types/auth';
import '../../styles/studio.css';

interface InviteMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (invitation: unknown) => void;
}

export function InviteMemberDialog({ isOpen, onClose, onInvite }: InviteMemberDialogProps) {
  const [inviteMethod, setInviteMethod] = useState<'userId' | 'username' | 'email' | 'friend'>('friend');
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<string>('');
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);

  useEffect(() => {
    if (isOpen && inviteMethod === 'friend') {
      void loadFriends();
    }
  }, [isOpen, inviteMethod]);

  const loadFriends = async () => {
    try {
      setLoadingFriends(true);
      const friendsList = await friendsApi.getFriends();
      setFriends(friendsList);
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setLoadingFriends(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async () => {
    let request: InviteMemberRequest;

    if (inviteMethod === 'userId') {
      if (!userId.trim()) {
        alert('Podaj ID użytkownika');
        return;
      }
      request = { userId: userId.trim() };
    } else if (inviteMethod === 'username') {
      if (!username.trim()) {
        alert('Podaj nazwę użytkownika');
        return;
      }
      request = { username: username.trim() };
    } else if (inviteMethod === 'email') {
      if (!email.trim()) {
        alert('Podaj email');
        return;
      }
      request = { email: email.trim() };
    } else {
      // friend
      if (!selectedFriend) {
        alert('Wybierz znajomego');
        return;
      }
      request = { userId: selectedFriend };
    }

    try {
      setLoading(true);
      const invitation = await studioApi.inviteMember(request);
      onInvite(invitation);
      onClose();
      // Reset form
      setUserId('');
      setUsername('');
      setEmail('');
      setSelectedFriend('');
    } catch (error) {
      console.error('Failed to invite member:', error);
      alert(error instanceof Error ? error.message : 'Nie udało się zaprosić użytkownika');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="project-editor-overlay" onClick={onClose}>
      <Card className="project-editor-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="project-editor-title">Zaproś do Ekipy</h2>

        <div className="project-editor-form">
          <div className="form-group">
            <label>Metoda zaproszenia:</label>
            <select
              value={inviteMethod}
              onChange={(e) => setInviteMethod(e.target.value as typeof inviteMethod)}
              disabled={loading}
            >
              <option value="friend">Z znajomych</option>
              <option value="userId">ID użytkownika</option>
              <option value="username">Nazwa użytkownika</option>
              <option value="email">Email</option>
            </select>
          </div>

          {inviteMethod === 'friend' && (
            <div className="form-group">
              <label>Znajomy:</label>
              {loadingFriends ? (
                <p>Ładowanie znajomych...</p>
              ) : friends.length === 0 ? (
                <p>Brak znajomych do zaproszenia</p>
              ) : (
                <select
                  value={selectedFriend}
                  onChange={(e) => setSelectedFriend(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Wybierz znajomego...</option>
                  {friends.map((friend) => (
                    <option key={friend.id} value={friend.id}>
                      {friend.email}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {inviteMethod === 'userId' && (
            <div className="form-group">
              <label htmlFor="invite-user-id">ID użytkownika:</label>
              <input
                id="invite-user-id"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user_123..."
                disabled={loading}
              />
            </div>
          )}

          {inviteMethod === 'username' && (
            <div className="form-group">
              <label htmlFor="invite-username">Nazwa użytkownika:</label>
              <input
                id="invite-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Display name"
                disabled={loading}
              />
            </div>
          )}

          {inviteMethod === 'email' && (
            <div className="form-group">
              <label htmlFor="invite-email">Email:</label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                disabled={loading}
              />
            </div>
          )}
        </div>

        <div className="project-editor-actions">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Anuluj
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={
              loading ||
              (inviteMethod === 'userId' && !userId.trim()) ||
              (inviteMethod === 'username' && !username.trim()) ||
              (inviteMethod === 'email' && !email.trim()) ||
              (inviteMethod === 'friend' && !selectedFriend)
            }
          >
            {loading ? 'Zapraszanie...' : 'Zaproś'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

