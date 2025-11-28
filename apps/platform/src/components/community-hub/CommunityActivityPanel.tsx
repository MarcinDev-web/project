/**
 * CommunityActivityPanel - Right panel with inline messages
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { messagesApi, type Conversation, type Message } from '../../api/messages';
import { profilesApi, type UserProfile } from '../../api/profiles';
import { useAuth } from '../../contexts/AuthContext';
import { useWebSocket, type WebSocketMessage } from '../../hooks/useWebSocket';

interface CommunityActivityPanelProps {
  selectedConversationId?: string;
  onConversationSelect: (conversationId: string) => void;
  onClose: () => void;
  unreadCount: number;
  onCountsUpdate: () => void;
}

export function CommunityActivityPanel({
  selectedConversationId,
  onConversationSelect,
  onClose,
  unreadCount,
  onCountsUpdate
}: CommunityActivityPanelProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedConversation = conversations.find(c => c.id === selectedConversationId) || 
    (selectedConversationId?.startsWith('temp_') ? {
      id: selectedConversationId,
      type: 'direct' as const,
      participants: [user?.id ?? '', selectedConversationId.replace('temp_', '')],
      lastMessageAt: Date.now(),
    } : null);

  // WebSocket handling
  const handleWebSocketMessage = useCallback((wsMessage: WebSocketMessage) => {
    if (wsMessage.type === 'message:new') {
      const newMessage = wsMessage.message;
      
      if (selectedConversation && newMessage.conversationId === selectedConversation.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
        setTimeout(scrollToBottom, 100);
      }
      
      // Refresh conversations list
      loadConversations();
      onCountsUpdate();
    } else if (wsMessage.type === 'message:read') {
      if (selectedConversation && wsMessage.conversationId === selectedConversation.id) {
        setMessages(prev => prev.map(msg => 
          msg.id === wsMessage.messageId 
            ? { ...msg, read: true, status: 'read' as const } 
            : msg
        ));
      }
    }
  }, [selectedConversation, onCountsUpdate]);

  useWebSocket(handleWebSocketMessage, true);

  useEffect(() => {
    if (user) {
      loadConversations();
    } else {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (selectedConversationId && !selectedConversationId.startsWith('temp_')) {
      loadMessages(selectedConversationId);
    } else {
      setMessages([]);
    }
  }, [selectedConversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const data = await messagesApi.getConversations();
      setConversations(data);
      
      // Load user profiles
      const profilesMap = new Map(userProfiles);
      for (const conv of data) {
        for (const participantId of conv.participants) {
          if (participantId && participantId !== user?.id && !profilesMap.has(participantId)) {
            try {
              const profile = await profilesApi.getProfile(participantId);
              if (profile) profilesMap.set(participantId, profile);
            } catch { /* ignore */ }
          }
        }
      }
      setUserProfiles(profilesMap);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const data = await messagesApi.getMessages(conversationId);
      setMessages(data);
      setTimeout(scrollToBottom, 150);
      
      // Mark messages as read
      const unreadMessages = data.filter(msg => msg.toUserId === user?.id && !msg.read);
      for (const msg of unreadMessages) {
        messagesApi.markAsRead(msg.id).catch(console.error);
      }
      
      if (unreadMessages.length > 0) {
        onCountsUpdate();
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const getUserDisplayName = (userId: string): string => {
    const profile = userProfiles.get(userId);
    if (!profile) return `User ${userId.substring(0, 8)}`;
    return profile.displayName || profile.username || profile.email?.split('@')[0] || `User ${userId.substring(0, 8)}`;
  };

  const getConversationDisplayName = (conv: Conversation): string => {
    if (conv.type === 'group') return conv.groupName ?? 'Group';
    const otherUserId = conv.participants.find(id => id !== user?.id);
    return otherUserId ? getUserDisplayName(otherUserId) : 'Unknown';
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim() || !selectedConversation || !user || sendingMessage) return;

    const content = messageContent.trim();
    setMessageContent('');
    setSendingMessage(true);

    const otherUserId = selectedConversation.participants.find(id => id !== user.id);
    if (!otherUserId) {
      setSendingMessage(false);
      return;
    }

    // Optimistic update
    const optimisticMessage: Message = {
      id: `temp_${Date.now()}`,
      conversationId: selectedConversation.id,
      fromUserId: user.id,
      toUserId: otherUserId,
      content,
      read: false,
      createdAt: Date.now(),
      status: 'sending',
    };

    setMessages(prev => [...prev, optimisticMessage]);
    scrollToBottom();

    try {
      const sentMessage = await messagesApi.sendMessage(otherUserId, content);
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === optimisticMessage.id 
            ? { ...sentMessage, status: 'sent' as const }
            : msg
        )
      );

      // Reload conversations for new conversation case
      if (selectedConversation.id.startsWith('temp_')) {
        const updatedConversations = await messagesApi.getConversations();
        setConversations(updatedConversations);
        
        const newConv = updatedConversations.find(conv => 
          conv.type === 'direct' && 
          conv.participants.includes(otherUserId) &&
          conv.participants.includes(user.id)
        );
        if (newConv) {
          onConversationSelect(newConv.id);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      setMessageContent(content);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!user) {
    return (
      <div className="activity-panel">
        <div className="activity-panel__header">
          <h3 className="activity-panel__title">Messages</h3>
        </div>
        <div className="activity-panel__empty">
          <p>Log in to view messages</p>
        </div>
      </div>
    );
  }

  // Show conversation list if no conversation selected
  if (!selectedConversation) {
    return (
      <div className="activity-panel">
        <div className="activity-panel__header">
          <h3 className="activity-panel__title">
            Messages
            {unreadCount > 0 && <span className="activity-panel__badge">{unreadCount}</span>}
          </h3>
        </div>
        
        <div className="activity-panel__conversations">
          {loading ? (
            <div className="activity-panel__loading">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="activity-panel__empty">
              <span className="activity-panel__empty-icon">💬</span>
              <p>No messages yet</p>
              <p className="activity-panel__hint">Click on a friend to start chatting</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                className="activity-panel__conv-item"
                onClick={() => onConversationSelect(conv.id)}
              >
                <div className="activity-panel__conv-avatar">
                  {getConversationDisplayName(conv).charAt(0).toUpperCase()}
                </div>
                <div className="activity-panel__conv-info">
                  <span className="activity-panel__conv-name">
                    {getConversationDisplayName(conv)}
                  </span>
                  <span className="activity-panel__conv-preview">
                    {conv.lastMessage?.substring(0, 25)}{(conv.lastMessage?.length ?? 0) > 25 ? '...' : ''}
                  </span>
                </div>
                {(conv.unreadCount ?? 0) > 0 && (
                  <span className="activity-panel__conv-unread">{conv.unreadCount}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // Show chat view
  return (
    <div className="activity-panel activity-panel--chat">
      <div className="activity-panel__chat-header">
        <button className="activity-panel__back" onClick={onClose}>
          ←
        </button>
        <div className="activity-panel__chat-user">
          <div className="activity-panel__chat-avatar">
            {getConversationDisplayName(selectedConversation).charAt(0).toUpperCase()}
          </div>
          <span className="activity-panel__chat-name">
            {getConversationDisplayName(selectedConversation)}
          </span>
        </div>
      </div>

      <div className="activity-panel__messages">
        {messages.length === 0 ? (
          <div className="activity-panel__no-messages">
            <p>No messages yet</p>
            <p className="activity-panel__hint">Start the conversation!</p>
          </div>
        ) : (
          messages.map(msg => (
            <div 
              key={msg.id} 
              className={`activity-panel__message ${msg.fromUserId === user.id ? 'activity-panel__message--sent' : 'activity-panel__message--received'}`}
            >
              <div className="activity-panel__message-bubble">
                {msg.content}
              </div>
              <div className="activity-panel__message-meta">
                <span className="activity-panel__message-time">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.fromUserId === user.id && (
                  <span className="activity-panel__message-status">
                    {msg.status === 'sending' ? '○' : msg.read ? '✓✓' : '✓'}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="activity-panel__input-area">
        <textarea
          ref={inputRef}
          className="activity-panel__input"
          placeholder="Type a message..."
          value={messageContent}
          onChange={(e) => setMessageContent(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={1}
          disabled={sendingMessage}
        />
        <button 
          className="activity-panel__send"
          onClick={handleSendMessage}
          disabled={!messageContent.trim() || sendingMessage}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  );
}

