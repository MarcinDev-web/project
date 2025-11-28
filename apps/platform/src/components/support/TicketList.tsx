import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { SupportTicket } from '../../api/support';
import { supportApi } from '../../api/support';
import './TicketList.css';

interface TicketListProps {
  filter?: {
    status?: SupportTicket['status'];
    priority?: SupportTicket['priority'];
  };
}

// Status configuration
const STATUS_CONFIG: Record<SupportTicket['status'], { label: string; icon: string; color: string }> = {
  open: { label: 'Open', icon: '🟢', color: '#22c55e' },
  in_progress: { label: 'In Progress', icon: '🔄', color: '#3b82f6' },
  resolved: { label: 'Resolved', icon: '✅', color: '#8b5cf6' },
  closed: { label: 'Closed', icon: '🔒', color: '#6b7280' },
};

// Priority configuration
const PRIORITY_CONFIG: Record<SupportTicket['priority'], { label: string; icon: string; color: string }> = {
  low: { label: 'Low', icon: '🟢', color: '#22c55e' },
  medium: { label: 'Medium', icon: '🟡', color: '#eab308' },
  high: { label: 'High', icon: '🟠', color: '#f97316' },
  urgent: { label: 'Urgent', icon: '🔴', color: '#ef4444' },
};

// Type configuration
const TYPE_CONFIG: Record<SupportTicket['type'], { label: string; icon: string }> = {
  question: { label: 'Question', icon: '❓' },
  bug: { label: 'Bug Report', icon: '🐛' },
  feature: { label: 'Feature', icon: '💡' },
  other: { label: 'Other', icon: '📝' },
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function TicketList({ filter }: TicketListProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTickets();
  }, [filter]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supportApi.getTickets(filter);
      setTickets(data);
    } catch (err) {
      console.error('Failed to load tickets:', err);
      setError('Failed to load tickets. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="ticket-list__loading">
        <div className="ticket-list__loading-spinner">⏳</div>
        <p className="ticket-list__loading-text">Loading your tickets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ticket-list__error">
        <div className="ticket-list__error-icon">⚠️</div>
        <p className="ticket-list__error-text">{error}</p>
        <button className="ticket-list__error-retry" onClick={loadTickets}>
          Try Again
        </button>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="ticket-list__empty">
        <div className="ticket-list__empty-icon">🎫</div>
        <h3 className="ticket-list__empty-title">No Tickets Yet</h3>
        <p className="ticket-list__empty-text">
          {filter?.status 
            ? `You don't have any ${filter.status.replace('_', ' ')} tickets.`
            : 'You haven\'t created any support tickets yet.'}
        </p>
        <Link to="/support" className="ticket-list__empty-cta">
          Create Your First Ticket
        </Link>
      </div>
    );
  }

  return (
    <div className="ticket-list">
      <div className="ticket-list__header">
        <span className="ticket-list__count">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="ticket-list__items">
        {tickets.map((ticket, index) => {
          const status = STATUS_CONFIG[ticket.status];
          const priority = PRIORITY_CONFIG[ticket.priority];
          const type = TYPE_CONFIG[ticket.type];

          return (
            <Link 
              key={ticket.id} 
              to={`/support/tickets/${ticket.id}`} 
              className="ticket-list__item"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="ticket-list__item-main">
                <div className="ticket-list__item-header">
                  <span className="ticket-list__item-type" title={type.label}>
                    {type.icon}
                  </span>
                  <h3 className="ticket-list__item-title">{ticket.title}</h3>
                  {ticket.priority === 'urgent' && (
                    <span className="ticket-list__item-urgent-badge">URGENT</span>
                  )}
                </div>
                <p className="ticket-list__item-description">
                  {ticket.description.substring(0, 150)}
                  {ticket.description.length > 150 ? '...' : ''}
                </p>
                <div className="ticket-list__item-meta">
                  <span 
                    className="ticket-list__item-status"
                    style={{ 
                      '--status-color': status.color,
                      backgroundColor: `${status.color}15`,
                      color: status.color,
                    } as React.CSSProperties}
                  >
                    <span className="ticket-list__item-status-icon">{status.icon}</span>
                    {status.label}
                  </span>
                  <span 
                    className="ticket-list__item-priority"
                    style={{ 
                      '--priority-color': priority.color,
                      backgroundColor: `${priority.color}15`,
                      color: priority.color,
                    } as React.CSSProperties}
                  >
                    <span className="ticket-list__item-priority-icon">{priority.icon}</span>
                    {priority.label}
                  </span>
                  <span className="ticket-list__item-id">#{ticket.id.slice(-6)}</span>
                </div>
              </div>
              <div className="ticket-list__item-side">
                <span className="ticket-list__item-time">{formatRelativeTime(ticket.createdAt)}</span>
                <span className="ticket-list__item-arrow">→</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

