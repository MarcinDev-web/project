import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../shared/Button';
import { messagesApi, type Conversation, type Message } from '../../api/messages';
import { profilesApi, type UserProfile } from '../../api/profiles';
import { friendsApi } from '../../api/friends';
import { useAuth } from '../../contexts/AuthContext';
import { useWebSocket, type WebSocketMessage } from '../../hooks/useWebSocket';

export function MessagesTab() {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetUserId = searchParams.get('user');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastTypingSentRef = useRef<number>(0);
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [sendingToAll, setSendingToAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Debug: log admin status
  useEffect(() => {
    console.log('MessagesTab - isAdmin:', isAdmin, 'user role:', user?.role);
  }, [isAdmin, user?.role]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToBottomInstant = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((wsMessage: WebSocketMessage) => {
    if (wsMessage.type === 'message:new') {
      const newMessage = wsMessage.message;
      
      // If this is our own message (sent from another tab/device or echoed back), update status to delivered
      if (newMessage.fromUserId === user?.id) {
        setMessages(prev => prev.map(msg => {
          // If we have a temp message with same content, replace it
          if (msg.id.startsWith('temp_') && msg.content === newMessage.content) {
            return { ...newMessage, status: 'delivered' as const };
          }
          // Update existing message if it's the same
          if (msg.id === newMessage.id) {
            return { ...newMessage, status: 'delivered' as const };
          }
          return msg;
        }));
      }
      
      // If this message is for the current conversation and it's from someone else, add it
      if (selectedConversation && newMessage.conversationId === selectedConversation.id) {
        if (newMessage.fromUserId !== user?.id) {
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
          
          // Scroll to bottom
          setTimeout(scrollToBottom, 100);
        }
      }
      
      // Update conversations list
      setConversations(prev => {
        const updated = prev.map(conv => {
          if (conv.id === newMessage.conversationId) {
            const isUnread = newMessage.toUserId === user?.id && !newMessage.read;
            const currentUnreadCount = conv.unreadCount ?? 0;
            return {
              ...conv,
              lastMessage: newMessage.content,
              lastMessageAt: newMessage.createdAt,
              unreadCount: isUnread ? currentUnreadCount + 1 : currentUnreadCount,
            };
          }
          return conv;
        });
        
        // Sort by lastMessageAt
        return updated.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      });
    } else if (wsMessage.type === 'message:read') {
      // Update message read status
      if (selectedConversation && wsMessage.conversationId === selectedConversation.id) {
        setMessages(prev => prev.map(msg => 
          msg.id === wsMessage.messageId 
            ? { ...msg, read: true, status: 'read' as const } 
            : msg
        ));
      }
    } else if (wsMessage.type === 'presence:online') {
      setOnlineUsers(prev => new Set(prev).add(wsMessage.userId));
    } else if (wsMessage.type === 'presence:offline') {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(wsMessage.userId);
        return next;
      });
    } else if (wsMessage.type === 'message:typing') {
      if (selectedConversation && wsMessage.conversationId === selectedConversation.id) {
        if (wsMessage.typing) {
          setTypingUsers(prev => new Set(prev).add(wsMessage.userId));
          
          // Clear existing timeout
          const existing = typingTimeoutRef.current.get(wsMessage.userId);
          if (existing) {
            clearTimeout(existing);
          }
          
          // Auto-remove typing indicator after 3 seconds
          const timeout = setTimeout(() => {
            setTypingUsers(prev => {
              const next = new Set(prev);
              next.delete(wsMessage.userId);
              return next;
            });
            typingTimeoutRef.current.delete(wsMessage.userId);
          }, 3000);
          
          typingTimeoutRef.current.set(wsMessage.userId, timeout);
        } else {
          setTypingUsers(prev => {
            const next = new Set(prev);
            next.delete(wsMessage.userId);
            return next;
          });
          const timeout = typingTimeoutRef.current.get(wsMessage.userId);
          if (timeout) {
            clearTimeout(timeout);
            typingTimeoutRef.current.delete(wsMessage.userId);
          }
        }
      }
    }
  }, [selectedConversation, user?.id]);

  const { sendMessage: sendWebSocketMessage } = useWebSocket(handleWebSocketMessage, true);

  useEffect(() => {
    if (user) {
      loadConversations();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Filter conversations when search term or conversations change
  useEffect(() => {
    if (!searchTerm) {
      setFilteredConversations(conversations);
      return;
    }
    
    const term = searchTerm.toLowerCase();
    const filtered = conversations.filter(conv => {
      const displayName = getConversationDisplayName(conv).toLowerCase();
      const lastMessage = conv.lastMessage?.toLowerCase() || '';
      return displayName.includes(term) || lastMessage.includes(term);
    });
    setFilteredConversations(filtered);
  }, [searchTerm, conversations, userProfiles]); // userProfiles needed for display name updates

  // Auto-select conversation when targetUserId is provided in URL
  useEffect(() => {
    if (targetUserId && conversations.length > 0 && !selectedConversation) {
      // Find existing conversation with this user
      const existingConv = conversations.find(conv => 
        conv.type === 'direct' && conv.participants.includes(targetUserId)
      );
      
      if (existingConv) {
        setSelectedConversation(existingConv);
        // Remove user param from URL after selecting conversation
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('user');
        setSearchParams(newParams, { replace: true });
      } else {
        // Create a temporary conversation object for new conversation
        // The actual conversation will be created when first message is sent
        const tempConv: Conversation = {
          id: `temp_${targetUserId}`,
          type: 'direct',
          participants: [user?.id || '', targetUserId],
          lastMessageAt: Date.now(),
        };
        setSelectedConversation(tempConv);
        // Remove user param from URL after setting up conversation
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('user');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [targetUserId, conversations, selectedConversation, user?.id, searchParams, setSearchParams]);

  useEffect(() => {
    if (selectedConversation) {
      // Don't load messages for temporary conversations (new conversations)
      if (!selectedConversation.id.startsWith('temp_')) {
        loadMessages(selectedConversation.id);
      } else {
        // For new conversations, clear messages
        setMessages([]);
      }
      
      // Mark all messages in conversation as read
      const unreadMessages = messages.filter(
        msg => msg.conversationId === selectedConversation.id && 
               msg.toUserId === user?.id && 
               !msg.read
      );
      
      for (const msg of unreadMessages) {
        messagesApi.markAsRead(msg.id).catch(console.error);
      }
      
      // Update unread count in conversations list
      if (unreadMessages.length > 0) {
        setConversations(prev => prev.map(conv =>
          conv.id === selectedConversation.id
            ? { ...conv, unreadCount: 0 }
            : conv
        ));
      }
    }
    // Cleanup typing indicators when conversation changes
    return () => {
      typingTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      typingTimeoutRef.current.clear();
      setTypingUsers(new Set());
    };
  }, [selectedConversation, user?.id]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const data = await messagesApi.getConversations();
      console.log('Conversations loaded:', data);
      setConversations(data);
      setFilteredConversations(data);
      
      // Load profiles for all participants
      const profilePromises: Promise<void>[] = [];
      const newProfiles = new Map(userProfiles);
      
      for (const conv of data) {
        for (const participantId of conv.participants) {
          if (participantId && participantId !== user?.id && !newProfiles.has(participantId)) {
            profilePromises.push(
              profilesApi.getProfile(participantId)
                .then(profile => {
                  if (profile) {
                    console.log(`Loaded profile for ${participantId}:`, profile);
                    newProfiles.set(participantId, profile);
                  }
                })
                .catch((error) => {
                  const status = (error as any)?.status;
                  // 404 is expected for users without profiles - use basic user data instead
                  if (status === 404) {
                    console.log(`Profile not found for ${participantId}, using basic user data`);
                    // We'll use getUserDisplayName fallback which shows User ID
                  } else {
                    console.error(`Failed to load profile for ${participantId}:`, error);
                  }
                })
            );
          }
        }
      }
      
      await Promise.all(profilePromises);
      setUserProfiles(newProfiles);
      
      // Load initial online status for friends
      try {
        const presence = await friendsApi.getPresence();
        console.log('Presence loaded:', presence);
        setOnlineUsers(new Set(Object.entries(presence).filter(([_, isOnline]) => isOnline).map(([userId]) => userId)));
      } catch (error) {
        console.error('Failed to load presence:', error);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const getUserDisplayName = (userId: string): string => {
    const profile = userProfiles.get(userId);
    if (!profile) return `User ${userId.substring(0, 8)}`;
    if (profile.displayName) return profile.displayName;
    if (profile.username) return profile.username;
    // email is required in PublicUser, so it's always a string
    return (profile.email ?? '').split('@')[0] || `User ${userId.substring(0, 8)}`;
  };
  
  const getUserAvatar = (userId: string): string | null => {
    const profile = userProfiles.get(userId);
    return profile?.avatarUrl ?? null;
  };

  const getConversationDisplayName = (conversation: Conversation): string => {
    if (conversation.type === 'group') {
      return conversation.groupName ?? 'Group';
    }
    const otherUserId = conversation.participants.find(id => id !== user?.id);
    if (otherUserId) {
      return getUserDisplayName(otherUserId);
    }
    return 'Unknown';
  };

  const getConversationAvatar = (conversation: Conversation): string | null => {
    if (conversation.type === 'group') {
      return conversation.groupAvatar ?? null;
    }
    const otherUserId = conversation.participants.find(id => id !== user?.id);
    if (otherUserId) {
      return getUserAvatar(otherUserId);
    }
    return null;
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const data = await messagesApi.getMessages(conversationId);
      setMessages(data);
      // Scroll to bottom after messages are loaded, use instant scroll to avoid jarring effect
      setTimeout(scrollToBottomInstant, 150);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim() || !selectedConversation || !user) return;

    const content = messageContent.trim();
    setMessageContent('');
    
    // Determine if this is a group conversation
    const isGroup = selectedConversation.type === 'group';
    const otherUserId = isGroup ? selectedConversation.id : selectedConversation.participants.find(id => id !== user.id);
    
    if (!otherUserId) return;
    
    // Create optimistic message with "sending" status
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
    
    // Add optimistic message to UI
    setMessages(prev => [...prev, optimisticMessage]);
    scrollToBottom();
    
    // Stop typing indicator
    if (selectedConversation) {
      sendWebSocketMessage({
        type: 'message:typing',
        timestamp: Date.now(),
        conversationId: selectedConversation.id,
        userId: user.id,
        typing: false,
      });
    }

    try {
      // Send message - use conversationId for groups
      const sentMessage = isGroup
        ? await messagesApi.sendMessage(otherUserId, content, selectedConversation.id)
        : await messagesApi.sendMessage(otherUserId, content);
      
      // Replace optimistic message with real message
      setMessages(prev => 
        prev.map(msg => 
          msg.id === optimisticMessage.id 
            ? { ...sentMessage, status: 'sent' as const }
            : msg
        )
      );
      
      // Reload conversations to get the new conversation if it was created
      const updatedConversations = await messagesApi.getConversations();
      setConversations(updatedConversations);
      
      // If we were using a temporary conversation, find and select the real one
      if (selectedConversation?.id.startsWith('temp_')) {
        const newConv = updatedConversations.find(conv => 
          conv.type === 'direct' && 
          conv.participants.includes(sentMessage.toUserId) &&
          conv.participants.includes(user.id)
        );
        if (newConv) {
          setSelectedConversation(newConv);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id === optimisticMessage.id));
      
      // Restore message content
      setMessageContent(content);
    }
  };

  // Handle typing indicator with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageContent(e.target.value);
    
    if (!selectedConversation || !user) return;
    
    // Debounce typing indicator (send at most once per 500ms)
    const now = Date.now();
    if (now - lastTypingSentRef.current > 500) {
      lastTypingSentRef.current = now;
      sendWebSocketMessage({
        type: 'message:typing',
        timestamp: now,
        conversationId: selectedConversation.id,
        userId: user.id,
        typing: true,
      });
    }
  };

  const handleSendToAll = async () => {
    if (!messageContent.trim() || !user || !isAdmin) return;

    const content = messageContent.trim();
    
    // Confirm before sending
    const confirmed = window.confirm(
      `Are you sure you want to send this message to all users?\n\nMessage: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`
    );

    if (!confirmed) return;

    setSendingToAll(true);
    try {
      const result = await messagesApi.sendMessageToAll(content);
      alert(`Message sent successfully to ${result.sent} user(s).`);
      setMessageContent('');
    } catch (error) {
      console.error('Failed to send message to all:', error);
      alert(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSendingToAll(false);
    }
  };

  return (
    <div className="messages-layout">
      {/* Conversations Sidebar */}
      <div className="conversations-sidebar">
        <div className="conversations-header">
          <h2 className="conversations-title">Messages</h2>
          <div className="conversations-search">
            <input
              type="text"
              className="forge-input"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="conversations-list">
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-2)' }}>
              {searchTerm ? 'No conversations found' : 'No conversations yet'}
            </div>
          ) : (
            filteredConversations.map(conv => {
              const otherUserId = conv.type === 'group' ? null : conv.participants.find(id => id !== user?.id);
              const avatarUrl = getConversationAvatar(conv);
              const displayName = getConversationDisplayName(conv);
              const unreadCount = conv.unreadCount ?? 0;
              
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''}`}
                >
                  <div className="conversation-avatar" style={{
                    backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined
                  }}>
                    {!avatarUrl && (displayName.charAt(0).toUpperCase() || (conv.type === 'group' ? '👥' : '?'))}
                    {conv.type === 'direct' && otherUserId && onlineUsers.has(otherUserId) && (
                      <div className="friend-status online" style={{ bottom: 0, right: 0 }} />
                    )}
                  </div>
                  <div className="conversation-info">
                    <div className="conversation-top">
                      <span className="conversation-name">{displayName}</span>
                      <span className="conversation-time">
                        {new Date(conv.lastMessageAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="conversation-bottom">
                      <span className="conversation-preview">
                        {conv.lastMessage || 'No messages yet'}
                      </span>
                      {unreadCount > 0 && (
                        <span className="conversation-unread">{unreadCount > 99 ? '99+' : unreadCount}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        {selectedConversation ? (
          <>
            <div className="chat-header">
              <div className="chat-user-info">
                <div className="conversation-avatar" style={{
                  width: '36px', height: '36px', fontSize: '1rem',
                  backgroundImage: getConversationAvatar(selectedConversation) ? `url(${getConversationAvatar(selectedConversation)})` : undefined
                }}>
                  {!getConversationAvatar(selectedConversation) && 
                   (getConversationDisplayName(selectedConversation).charAt(0).toUpperCase())}
                </div>
                <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>
                  {getConversationDisplayName(selectedConversation)}
                </span>
              </div>
            </div>

            <div className="chat-messages">
              {messages.map(msg => (
                <div key={msg.id} className={`message-group ${msg.fromUserId === user?.id ? 'sent' : 'received'}`}>
                  <div className="message-bubble">
                    {msg.content}
                  </div>
                  <div className="message-status">
                    <span className="message-time">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.fromUserId === user?.id && (
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>
                        {msg.status === 'sending' ? '○' : 
                         msg.read ? '✓✓' : 
                         msg.status === 'delivered' ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              
              {typingUsers.size > 0 && (
                <div className="chat-typing">
                  {Array.from(typingUsers).map(userId => (
                    <span key={userId}>
                      User {userId.substring(0, 8)} is typing...
                    </span>
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Admin Broadcast Input - Only visible if user is admin */}
            {isAdmin && (
               <div className="admin-broadcast-bar">
                 <span style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: 'bold' }}>ADMIN:</span>
                 <input
                    type="text"
                    placeholder="Type to send to EVERYONE (Broadcast)"
                    value={messageContent} 
                    onChange={handleInputChange}
                    style={{ 
                      flex: 1, 
                      background: 'transparent', 
                      border: 'none', 
                      color: 'var(--text-1)', 
                      fontSize: '12px',
                      borderBottom: '1px dashed rgba(239, 68, 68, 0.5)' 
                    }}
                 />
                 <Button 
                   onClick={handleSendToAll} 
                   variant="danger" 
                   size="small"
                   disabled={!messageContent.trim() || sendingToAll}
                   style={{ padding: '2px 8px', fontSize: '10px' }}
                 >
                   Broadcast
                 </Button>
               </div>
            )}

            <div className="chat-input-area">
              <textarea
                className="chat-input"
                placeholder="Type a message..."
                value={messageContent}
                onChange={handleInputChange}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={1}
              />
              <button className="chat-send-btn" onClick={handleSendMessage}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="empty-chat-state">
            <div className="empty-icon">💬</div>
            <h3>Select a conversation</h3>
            <p>Choose a conversation from the list to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
