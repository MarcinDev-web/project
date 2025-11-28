/**
 * UnifiedCommunityView - Integrated community experience
 * Combines Forum, Friends, and Messages into a 3-column layout
 * Mobile: switches to tabs
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CommunityTab } from './CommunityTab';
import { CommunitySidebar } from './CommunitySidebar';
import { CommunityActivityPanel } from './CommunityActivityPanel';
import { useAuth } from '../../contexts/AuthContext';
import { friendsApi } from '../../api/friends';
import { messagesApi, type Conversation } from '../../api/messages';
import '../../styles/unified-community.css';

interface UnifiedCommunityViewProps {
  initialChatOpen?: boolean;
  initialChatUserId?: string;
}

type MobileTab = 'forum' | 'friends' | 'messages';

export function UnifiedCommunityView({ 
  initialChatOpen = false, 
  initialChatUserId 
}: UnifiedCommunityViewProps) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(initialChatOpen);
  const [mobileTab, setMobileTab] = useState<MobileTab>('forum');
  
  // Counts for badges
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);
  
  // Load counts on mount
  useEffect(() => {
    if (user) {
      loadCounts();
    }
  }, [user]);

  // Handle initial chat user
  useEffect(() => {
    if (initialChatUserId && user) {
      openChatWithUser(initialChatUserId);
    }
  }, [initialChatUserId, user]);

  const loadCounts = async () => {
    try {
      const [conversations, requests] = await Promise.all([
        messagesApi.getConversations().catch(() => []),
        friendsApi.getRequests().catch(() => []),
      ]);
      
      // Count unread messages
      const unreadCount = conversations.reduce((sum, conv) => sum + (conv.unreadCount ?? 0), 0);
      setUnreadMessagesCount(unreadCount);
      
      // Count pending friend requests
      const pendingRequests = requests.filter(r => r.status === 'pending');
      setFriendRequestsCount(pendingRequests.length);
    } catch (error) {
      console.error('Failed to load counts:', error);
    }
  };

  const openChatWithUser = async (userId: string) => {
    try {
      // Find or create conversation with this user
      const conversations = await messagesApi.getConversations();
      const existingConv = conversations.find(conv => 
        conv.type === 'direct' && conv.participants.includes(userId)
      );
      
      if (existingConv) {
        setSelectedConversationId(existingConv.id);
      } else {
        // Create temp conversation ID - will be created when first message is sent
        setSelectedConversationId(`temp_${userId}`);
      }
      
      setIsChatPanelOpen(true);
      setMobileTab('messages');
    } catch (error) {
      console.error('Failed to open chat:', error);
    }
  };

  const handleFriendClick = useCallback((friendId: string) => {
    openChatWithUser(friendId);
  }, []);

  const handleConversationClick = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    setIsChatPanelOpen(true);
    setMobileTab('messages');
  }, []);

  const handleCloseChatPanel = useCallback(() => {
    setIsChatPanelOpen(false);
    setSelectedConversationId(undefined);
    // Clean up URL params
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('chat');
    newParams.delete('chatOpen');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleMobileTabChange = (tab: MobileTab) => {
    setMobileTab(tab);
    if (tab === 'messages') {
      setIsChatPanelOpen(true);
    }
  };

  const handleCountsUpdate = useCallback(() => {
    loadCounts();
  }, []);

  return (
    <div className="unified-community">
      {/* Header with title and mobile tabs */}
      <header className="unified-community__header">
        <h1 className="unified-community__title">Community Hub</h1>
        
        {/* Mobile tab navigation */}
        <nav className="unified-community__mobile-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mobileTab === 'forum'}
            onClick={() => handleMobileTabChange('forum')}
            className={`unified-community__mobile-tab ${mobileTab === 'forum' ? 'unified-community__mobile-tab--active' : ''}`}
          >
            <span className="unified-community__mobile-tab-icon">💬</span>
            <span className="unified-community__mobile-tab-label">Forum</span>
          </button>
          <button
            role="tab"
            aria-selected={mobileTab === 'friends'}
            onClick={() => handleMobileTabChange('friends')}
            className={`unified-community__mobile-tab ${mobileTab === 'friends' ? 'unified-community__mobile-tab--active' : ''}`}
          >
            <span className="unified-community__mobile-tab-icon">👥</span>
            <span className="unified-community__mobile-tab-label">Friends</span>
            {friendRequestsCount > 0 && (
              <span className="unified-community__badge">{friendRequestsCount}</span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={mobileTab === 'messages'}
            onClick={() => handleMobileTabChange('messages')}
            className={`unified-community__mobile-tab ${mobileTab === 'messages' ? 'unified-community__mobile-tab--active' : ''}`}
          >
            <span className="unified-community__mobile-tab-icon">✉️</span>
            <span className="unified-community__mobile-tab-label">Messages</span>
            {unreadMessagesCount > 0 && (
              <span className="unified-community__badge">{unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}</span>
            )}
          </button>
        </nav>
      </header>

      {/* 3-column layout (desktop) / tabs content (mobile) */}
      <div className="unified-community__layout">
        {/* Left sidebar - Friends & Chats */}
        <aside className={`unified-community__sidebar ${mobileTab === 'friends' ? 'unified-community__sidebar--mobile-visible' : ''}`}>
          <CommunitySidebar
            onFriendClick={handleFriendClick}
            onConversationClick={handleConversationClick}
            friendRequestsCount={friendRequestsCount}
            onCountsUpdate={handleCountsUpdate}
          />
        </aside>

        {/* Main content - Forum */}
        <main className={`unified-community__main ${mobileTab === 'forum' ? 'unified-community__main--mobile-visible' : ''}`}>
          <CommunityTab />
        </main>

        {/* Right panel - Messages */}
        <aside className={`unified-community__activity ${mobileTab === 'messages' ? 'unified-community__activity--mobile-visible' : ''} ${isChatPanelOpen ? 'unified-community__activity--open' : ''}`}>
          <CommunityActivityPanel
            selectedConversationId={selectedConversationId}
            onConversationSelect={handleConversationClick}
            onClose={handleCloseChatPanel}
            unreadCount={unreadMessagesCount}
            onCountsUpdate={handleCountsUpdate}
          />
        </aside>
      </div>
    </div>
  );
}

