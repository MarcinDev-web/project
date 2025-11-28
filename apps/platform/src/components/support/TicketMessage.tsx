import type { SupportTicketMessage } from '../../api/support';
import './TicketMessage.css';

interface TicketMessageProps {
  message: SupportTicketMessage;
  authorName?: string;
  isCurrentUser?: boolean;
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TicketMessage({ message, authorName, isCurrentUser }: TicketMessageProps) {
  if (message.isInternal) {
    return (
      <div className="ticket-message ticket-message--internal">
        <div className="ticket-message__header">
          <div className="ticket-message__author ticket-message__author--internal">
            <span className="ticket-message__author-icon">📝</span>
            Internal Note
          </div>
          <div className="ticket-message__time">{formatTime(message.createdAt)}</div>
        </div>
        <div className="ticket-message__content">{message.content}</div>
      </div>
    );
  }

  const author = authorName || (isCurrentUser ? 'You' : 'Support Team');

  return (
    <div className={`ticket-message ${isCurrentUser ? 'ticket-message--user' : 'ticket-message--support'}`}>
      <div className="ticket-message__avatar">
        {isCurrentUser ? '👤' : '🛠️'}
      </div>
      <div className="ticket-message__bubble">
        <div className="ticket-message__header">
          <div className="ticket-message__author">
            {author}
            {!isCurrentUser && <span className="ticket-message__badge">Support</span>}
          </div>
          <div className="ticket-message__time">{formatTime(message.createdAt)}</div>
        </div>
        <div className="ticket-message__content">{message.content}</div>
      </div>
    </div>
  );
}

