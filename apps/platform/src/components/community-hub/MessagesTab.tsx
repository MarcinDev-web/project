import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../shared/Card';
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
      console.log('User profiles loaded:', { 
        profilesCount: newProfiles.size, 
        profiles: Array.from(newProfiles.entries()).map(([id, profile]) => ({ id, email: profile.email, displayName: profile.displayName }))
      });
      
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
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        status: (error as any)?.status,
        apiError: (error as any)?.apiError,
      });
      // Only show alert for actual errors, not for empty results
      if (error instanceof Error && error.message !== 'Request failed') {
        alert(`Failed to load conversations: ${error.message}`);
      }
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
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--spacing-4)', maxWidth: '900px', margin: '0 auto' }}>
        {/* Conversations list */}
        <Card>
          <h2 style={{ marginTop: 0, marginBottom: 'var(--spacing-3)', fontSize: 'var(--text-lg)' }}>Conversations</h2>
          {loading ? (
            <div>Loading...</div>
          ) : conversations.length === 0 ? (
            <p style={{ color: 'var(--text-2)' }}>No conversations</p>
          ) : (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 'var(--spacing-2)',
              maxHeight: '500px',
              overflowY: 'auto'
            }}>
              {conversations.map(conv => {
                const otherUserId = conv.type === 'group' ? null : conv.participants.find(id => id !== user?.id);
                const avatarUrl = getConversationAvatar(conv);
                const displayName = getConversationDisplayName(conv);
                const unreadCount = conv.unreadCount ?? 0;
                
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    style={{
                      padding: 'var(--spacing-3)',
                      background: selectedConversation?.id === conv.id 
                        ? 'var(--bg-button-active)' 
                        : 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-1)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-3)',
                      position: 'relative',
                    }}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: avatarUrl ? `url(${avatarUrl}) center/cover` : 'var(--bg-button)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--text-lg)',
                      flexShrink: 0,
                      position: 'relative',
                    }}>
                      {!avatarUrl && (displayName.charAt(0).toUpperCase() || conv.type === 'group' ? '👥' : '?')}
                      {conv.type === 'direct' && otherUserId && onlineUsers.has(otherUserId) && (
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: '#4ade80',
                          border: '2px solid var(--bg-panel)',
                        }} />
                      )}
                      {conv.type === 'group' && (
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: 'var(--bg-button-primary)',
                          border: '2px solid var(--bg-panel)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '8px',
                        }}>
                          👥
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontSize: 'var(--text-sm)', 
                        fontWeight: unreadCount > 0 ? 'var(--font-bold)' : 'var(--font-medium)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-2)',
                      }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {displayName}
                        </span>
                        {unreadCount > 0 && (
                          <span style={{
                            background: 'var(--bg-button-primary)',
                            color: 'white',
                            borderRadius: '50%',
                            minWidth: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'var(--text-xs)',
                            padding: '0 var(--spacing-1)',
                          }}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <div style={{ 
                          fontSize: 'var(--text-xs)', 
                          color: 'var(--text-2)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: 'var(--spacing-1)',
                        }}>
                          {conv.lastMessage}
                        </div>
                      )}
                      <div style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-3)',
                        marginTop: 'var(--spacing-1)',
                      }}>
                        {new Date(conv.lastMessageAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          ...(new Date().getTime() - conv.lastMessageAt > 86400000 * 7 && {
                            year: 'numeric',
                          }),
                        })}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Messages */}
        <Card style={{ display: 'flex', flexDirection: 'column', ...(selectedConversation ? { height: '100%' } : {}) }}>
          {selectedConversation ? (
            <>
              <div style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                marginBottom: 'var(--spacing-2)',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: 'var(--spacing-2)',
              }}>
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      marginBottom: 'var(--spacing-2)',
                      textAlign: msg.fromUserId === user?.id ? 'right' : 'left',
                    }}
                  >
                    <div style={{
                      display: 'inline-block',
                      padding: 'var(--spacing-1) var(--spacing-2)',
                      background: msg.fromUserId === user?.id
                        ? 'var(--bg-button-primary)'
                        : 'var(--bg-button)',
                      borderRadius: 'var(--radius-md)',
                      maxWidth: '70%',
                    }}>
                      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: msg.fromUserId === user?.id ? 'white' : 'var(--text-1)' }}>
                        {msg.content}
                      </p>
                      <div style={{ display: 'flex', gap: 'var(--spacing-1)', alignItems: 'center', justifyContent: msg.fromUserId === user?.id ? 'flex-end' : 'flex-start', marginTop: '2px' }}>
                        <span style={{
                          fontSize: '10px',
                          color: msg.fromUserId === user?.id ? 'rgba(255,255,255,0.7)' : 'var(--text-3)',
                        }}>
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </span>
                        {msg.fromUserId === user?.id && (
                          <span style={{
                            fontSize: '10px',
                            color: 'rgba(255,255,255,0.7)',
                          }}>
                            {msg.status === 'sending' ? '○' : 
                             msg.read ? '✓✓' : 
                             msg.status === 'delivered' ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {typingUsers.size > 0 && (
                  <div style={{ 
                    marginTop: 'var(--spacing-1)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-2)',
                    fontStyle: 'italic',
                  }}>
                    {Array.from(typingUsers).map(userId => (
                      <div key={userId}>
                        User {userId.substring(0, 8)} is typing...
                      </div>
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                <input
                  type="text"
                  value={messageContent}
                  onChange={handleInputChange}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  style={{
                    flex: 1,
                    padding: 'var(--spacing-1) var(--spacing-2)',
                    background: 'var(--bg-button)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-1)',
                    fontSize: 'var(--text-sm)',
                  }}
                />
                {isAdmin && (
                  <Button 
                    onClick={handleSendToAll} 
                    disabled={!messageContent.trim() || sendingToAll}
                    variant="danger"
                    size="small"
                    style={{
                      opacity: sendingToAll ? 0.6 : 1,
                      fontSize: 'var(--text-xs)',
                      padding: 'var(--spacing-1) var(--spacing-2)',
                    }}
                  >
                    {sendingToAll ? 'Sending...' : 'Send to All'}
                  </Button>
                )}
                <Button onClick={handleSendMessage} size="small">Send</Button>
              </div>
            </>
          ) : (
            <>
              {isAdmin && (
                <div style={{ 
                  marginBottom: 'var(--spacing-3)', 
                  paddingBottom: 'var(--spacing-3)',
                  borderBottom: '1px solid var(--border-default)',
                }}>
                  <h3 style={{ marginTop: 0, marginBottom: 'var(--spacing-2)', fontSize: 'var(--text-md)' }}>Send Message to All Users</h3>
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                    <input
                      type="text"
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendToAll()}
                      placeholder="Type a message to send to all users..."
                      style={{
                        flex: 1,
                        padding: 'var(--spacing-1) var(--spacing-2)',
                        background: 'var(--bg-button)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-1)',
                        fontSize: 'var(--text-sm)',
                      }}
                    />
                    <Button 
                      onClick={handleSendToAll} 
                      disabled={!messageContent.trim() || sendingToAll}
                      variant="danger"
                      size="small"
                      style={{
                        opacity: sendingToAll ? 0.6 : 1,
                      }}
                    >
                      {sendingToAll ? 'Sending...' : 'Send to All'}
                    </Button>
                  </div>
                </div>
              )}
              <div style={{ textAlign: 'center', padding: 'var(--spacing-6)', color: 'var(--text-2)', fontSize: 'var(--text-sm)' }}>
                Select a conversation to view messages
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

