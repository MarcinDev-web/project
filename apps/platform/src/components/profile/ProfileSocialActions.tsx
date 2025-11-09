import { memo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../shared/Button';
import { friendsApi } from '../../api/friends';
import { useToast } from '../../contexts/ToastContext';
import type { ProfileSocialStats } from '../../api/profiles';

interface ProfileSocialActionsProps {
  userId: string;
  displayName: string;
  socialStats: ProfileSocialStats | null;
  isOwnProfile: boolean;
  onFriendshipChanged: () => void;
}

/**
 * ProfileSocialActions - szybkie akcje społecznościowe na profilu
 * 
 * Zawiera:
 * - Dodaj/Usuń znajomego (z obsługą pending requests)
 * - Wyślij wiadomość (tylko dla znajomych)
 * - Zobacz posty na forum
 */
export const ProfileSocialActions = memo(function ProfileSocialActions({
  userId,
  displayName,
  socialStats,
  isOwnProfile,
  onFriendshipChanged,
}: ProfileSocialActionsProps) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFriendAction = async () => {
    if (isProcessing || !socialStats) return;

    setIsProcessing(true);
    try {
      if (socialStats.friendshipStatus === 'accepted') {
        // Remove friend
        await friendsApi.removeFriend(userId);
        showToast('Usunięto ze znajomych', 'info');
        onFriendshipChanged();
      } else if (socialStats.friendshipStatus === 'pending') {
        if (socialStats.isPendingFromCurrentUser) {
          // Cancel sent request
          if (socialStats.pendingRequestId) {
            await friendsApi.declineRequest(socialStats.pendingRequestId);
            showToast('Anulowano zaproszenie', 'info');
          }
          onFriendshipChanged();
        } else {
          // Accept incoming request
          if (socialStats.pendingRequestId) {
            await friendsApi.acceptRequest(socialStats.pendingRequestId);
            showToast('Zaakceptowano zaproszenie', 'success');
            onFriendshipChanged();
          }
        }
      } else {
        // Send friend request
        await friendsApi.sendRequest(userId);
        showToast('Wysłano zaproszenie do znajomych', 'success');
        onFriendshipChanged();
      }
    } catch (error) {
      console.error('Failed to handle friend action:', error);
      const errorMessage = error instanceof Error ? error.message : 'Nie udało się wykonać akcji';
      showToast(`Błąd: ${errorMessage}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = () => {
    // Navigate to messages page - the MessagesTab will handle creating conversation if needed
    navigate(`/community-hub?tab=messages&user=${userId}`);
  };

  const getFriendButtonText = (): string => {
    if (!socialStats) return 'Dodaj znajomego';
    
    if (socialStats.friendshipStatus === 'accepted') {
      return 'Usuń ze znajomych';
    } else if (socialStats.friendshipStatus === 'pending') {
      if (socialStats.isPendingFromCurrentUser) {
        return 'Anuluj zaproszenie';
      }
      return 'Zaakceptuj zaproszenie';
    }
    return 'Dodaj znajomego';
  };

  const getFriendButtonVariant = (): 'primary' | 'secondary' | 'danger' => {
    if (!socialStats) return 'primary';
    
    if (socialStats.friendshipStatus === 'accepted') {
      return 'danger';
    } else if (socialStats.friendshipStatus === 'pending') {
      if (socialStats.isPendingFromCurrentUser) {
        return 'secondary';
      }
      return 'primary';
    }
    return 'primary';
  };

  if (isOwnProfile) {
    return (
      <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
        <Link to="/settings">
          <Button variant="secondary">Edytuj profil</Button>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
      <Button
        variant={getFriendButtonVariant()}
        onClick={handleFriendAction}
        disabled={isProcessing}
      >
        {isProcessing ? 'Przetwarzanie...' : getFriendButtonText()}
      </Button>

      {socialStats?.friendshipStatus === 'accepted' && (
        <Button
          variant="secondary"
          onClick={handleSendMessage}
        >
          Wyślij wiadomość
        </Button>
      )}

      <Link to={`/community-hub?tab=community&author=${userId}`}>
        <Button variant="secondary">
          Posty na forum
        </Button>
      </Link>
    </div>
  );
});
