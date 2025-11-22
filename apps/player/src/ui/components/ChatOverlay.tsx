import React, { useState, useEffect, useRef } from 'react';
import { chatSystem, type ChatMessage } from '../../systems/ChatSystem.js';

/**
 * Chat overlay component
 */
export function ChatOverlay(): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Subscribe to chat system updates
    const unsubscribe = chatSystem.subscribe((msgs) => {
      setMessages(msgs);
    });
    return unsubscribe;
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current && isExpanded) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  return (
    <div style={styles.container}>
      {isExpanded ? (
        <div style={styles.expanded}>
          <div style={styles.header}>
            <span style={styles.headerText}>Chat</span>
            <button
              style={styles.toggleButton}
              onClick={() => {
                setIsExpanded(false);
              }}
            >
              −
            </button>
          </div>
          <div style={styles.messages}>
            {messages.length === 0 ? (
              <div style={styles.emptyMessage}>No messages</div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} style={styles.message}>
                  {msg.isSystem ? (
                    <span style={styles.systemMessage}>{msg.message}</span>
                  ) : (
                    <>
                      <span style={styles.sender}>{msg.displayName}:</span> {msg.message}
                    </>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <input
            style={styles.input}
            type="text"
            placeholder="Type a message..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const value = e.currentTarget.value;
                if (value.trim()) {
                  chatSystem.sendMessage(value);
                  e.currentTarget.value = '';
                }
              }
            }}
          />
        </div>
      ) : (
        <button
          style={styles.collapsed}
          onClick={() => {
            setIsExpanded(true);
          }}
        >
          Chat {messages.length > 0 && `(${messages.length})`}
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    zIndex: 1001,
    pointerEvents: 'all',
  },
  collapsed: {
    padding: '0.5rem 1rem',
    backgroundColor: 'rgba(15, 19, 24, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  expanded: {
    width: '300px',
    maxHeight: '400px',
    backgroundColor: 'rgba(15, 19, 24, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 1rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  headerText: {
    color: '#fff',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  toggleButton: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '1.25rem',
    padding: 0,
    width: '24px',
    height: '24px',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.5rem',
    minHeight: '200px',
    maxHeight: '300px',
  },
  emptyMessage: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.875rem',
    textAlign: 'center',
    padding: '1rem',
  },
  message: {
    color: '#fff',
    fontSize: '0.875rem',
    marginBottom: '0.5rem',
    wordBreak: 'break-word',
  },
  systemMessage: {
    color: '#ffff00',
    fontStyle: 'italic',
  },
  sender: {
    fontWeight: 500,
    color: '#4a9eff',
  },
  input: {
    padding: '0.5rem 1rem',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '0.875rem',
    outline: 'none',
    margin: '0.5rem',
  },
};
