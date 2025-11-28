import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Layout } from '../layout/Layout';
import type { SupportTicketWithMessages } from '../../api/support';
import { supportApi } from '../../api/support';
import { Button } from '../shared/Button';
import { TicketMessage } from './TicketMessage';
import './TicketDetail.css';

// Status configuration
const STATUS_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  open: { label: 'Open', icon: '🟢', color: '#22c55e' },
  in_progress: { label: 'In Progress', icon: '🔄', color: '#3b82f6' },
  resolved: { label: 'Resolved', icon: '✅', color: '#8b5cf6' },
  closed: { label: 'Closed', icon: '🔒', color: '#6b7280' },
};

// Priority configuration
const PRIORITY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  low: { label: 'Low', icon: '🟢', color: '#22c55e' },
  medium: { label: 'Medium', icon: '🟡', color: '#eab308' },
  high: { label: 'High', icon: '🟠', color: '#f97316' },
  urgent: { label: 'Urgent', icon: '🔴', color: '#ef4444' },
};

// Type configuration  
const TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  question: { label: 'Question', icon: '❓' },
  bug: { label: 'Bug Report', icon: '🐛' },
  feature: { label: 'Feature Request', icon: '💡' },
  other: { label: 'Other', icon: '📝' },
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<SupportTicketWithMessages | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      loadTicket();
    }
  }, [id]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const loadTicket = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await supportApi.getTicket(id);
      setTicket(data);
    } catch (err) {
      console.error('Failed to load ticket:', err);
      setError('Failed to load ticket. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newMessage.trim()) return;

    try {
      setSubmitting(true);
      await supportApi.addMessage(id, { content: newMessage.trim() });
      setNewMessage('');
      await loadTicket();
    } catch (err) {
      console.error('Failed to add message:', err);
      setError(err instanceof Error ? err.message : 'Failed to add message');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!id || !ticket) return;

    try {
      await supportApi.updateTicket(id, { status: 'closed' });
      await loadTicket();
      setShowCloseConfirm(false);
    } catch (err) {
      console.error('Failed to close ticket:', err);
      setError(err instanceof Error ? err.message : 'Failed to close ticket');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="page-container">
          <div className="ticket-detail__loading">
            <div className="ticket-detail__loading-spinner">⏳</div>
            <p className="ticket-detail__loading-text">Loading ticket...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !ticket) {
    return (
      <Layout>
        <div className="page-container">
          <div className="ticket-detail__error">
            <div className="ticket-detail__error-icon">⚠️</div>
            <p className="ticket-detail__error-text">{error || 'Ticket not found'}</p>
            <Button onClick={() => navigate('/support')}>Back to Support</Button>
          </div>
        </div>
      </Layout>
    );
  }

  const isCurrentUser = ticket.userId === user?.id;
  const canClose = isCurrentUser && ticket.status !== 'closed';
  const status = STATUS_CONFIG[ticket.status];
  const priority = PRIORITY_CONFIG[ticket.priority];
  const type = TYPE_CONFIG[ticket.type];

  return (
    <Layout>
      <div className="page-container">
        <div className="ticket-detail">
          {/* Breadcrumb */}
          <nav className="ticket-detail__breadcrumb">
            <Link to="/support" className="ticket-detail__breadcrumb-link">
              Support Center
            </Link>
            <span className="ticket-detail__breadcrumb-separator">›</span>
            <Link to="/support?tab=tickets" className="ticket-detail__breadcrumb-link">
              My Tickets
            </Link>
            <span className="ticket-detail__breadcrumb-separator">›</span>
            <span className="ticket-detail__breadcrumb-current">#{id?.slice(-6)}</span>
          </nav>

          {/* Main Content */}
          <div className="ticket-detail__content">
            {/* Ticket Info Panel */}
            <div className="ticket-detail__info">
              <div className="ticket-detail__header">
                <div className="ticket-detail__header-top">
                  <span className="ticket-detail__type">{type?.icon}</span>
                  <h1 className="ticket-detail__title">{ticket.title}</h1>
                </div>
                <div className="ticket-detail__badges">
                  <span 
                    className="ticket-detail__badge ticket-detail__badge--status"
                    style={{ 
                      backgroundColor: `${status?.color}15`,
                      color: status?.color,
                      borderColor: `${status?.color}30`,
                    }}
                  >
                    {status?.icon} {status?.label}
                  </span>
                  <span 
                    className="ticket-detail__badge ticket-detail__badge--priority"
                    style={{ 
                      backgroundColor: `${priority?.color}15`,
                      color: priority?.color,
                      borderColor: `${priority?.color}30`,
                    }}
                  >
                    {priority?.icon} {priority?.label}
                  </span>
                  <span className="ticket-detail__badge ticket-detail__badge--type">
                    {type?.label}
                  </span>
                </div>
                <div className="ticket-detail__meta">
                  <span className="ticket-detail__meta-item">
                    <span className="ticket-detail__meta-icon">📅</span>
                    Created {formatDate(ticket.createdAt)}
                  </span>
                  <span className="ticket-detail__meta-item">
                    <span className="ticket-detail__meta-icon">🔄</span>
                    Updated {formatDate(ticket.updatedAt)}
                  </span>
                </div>
              </div>

              <div className="ticket-detail__description">
                <h3 className="ticket-detail__description-title">Description</h3>
                <div className="ticket-detail__description-content">
                  {ticket.description}
                </div>
              </div>

              {canClose && (
                <div className="ticket-detail__actions">
                  {showCloseConfirm ? (
                    <div className="ticket-detail__close-confirm">
                      <p>Are you sure you want to close this ticket?</p>
                      <div className="ticket-detail__close-confirm-buttons">
                        <Button variant="secondary" onClick={() => setShowCloseConfirm(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleCloseTicket}>
                          Yes, Close Ticket
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      className="ticket-detail__close-btn"
                      onClick={() => setShowCloseConfirm(true)}
                    >
                      🔒 Close Ticket
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Messages Section */}
            <div className="ticket-detail__messages">
              <div className="ticket-detail__messages-header">
                <h2 className="ticket-detail__messages-title">
                  <span>💬</span>
                  Conversation
                  {ticket.messages.length > 0 && (
                    <span className="ticket-detail__messages-count">{ticket.messages.length}</span>
                  )}
                </h2>
              </div>

              <div className="ticket-detail__messages-list">
                {ticket.messages.length === 0 ? (
                  <div className="ticket-detail__no-messages">
                    <span className="ticket-detail__no-messages-icon">💬</span>
                    <p className="ticket-detail__no-messages-text">
                      No messages yet. Start the conversation below!
                    </p>
                  </div>
                ) : (
                  <>
                    {ticket.messages.map((message, index) => (
                      <TicketMessage
                        key={message.id}
                        message={message}
                        isCurrentUser={message.authorId === user?.id}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Input */}
              {ticket.status !== 'closed' ? (
                <form onSubmit={handleAddMessage} className="ticket-detail__message-form">
                  <div className="ticket-detail__message-input-wrapper">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="ticket-detail__message-input"
                      rows={3}
                    />
                    <div className="ticket-detail__message-form-footer">
                      <span className="ticket-detail__message-hint">
                        Press Enter to send, Shift+Enter for new line
                      </span>
                      <Button 
                        type="submit" 
                        disabled={submitting || !newMessage.trim()}
                      >
                        {submitting ? (
                          <>
                            <span className="ticket-detail__send-spinner">⏳</span>
                            Sending...
                          </>
                        ) : (
                          <>Send Message</>
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="ticket-detail__closed-notice">
                  <span className="ticket-detail__closed-icon">🔒</span>
                  <p className="ticket-detail__closed-text">
                    This ticket is closed. Need more help? 
                    <Link to="/support" className="ticket-detail__closed-link">
                      Create a new ticket
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

