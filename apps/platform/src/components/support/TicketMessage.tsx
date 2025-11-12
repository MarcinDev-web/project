import type { SupportTicketMessage } from '../../api/support';
import { Card } from '../shared/Card';

interface TicketMessageProps {
  message: SupportTicketMessage;
  authorName?: string;
  isCurrentUser?: boolean;
}

export function TicketMessage({ message, authorName, isCurrentUser }: TicketMessageProps) {
  if (message.isInternal) {
    return (
      <Card style={{ background: 'var(--color-warning-bg)', border: '1px dashed var(--color-warning)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-2)' }}>
          <div style={{ fontWeight: 'bold', color: 'var(--color-warning)' }}>
            Internal Note
          </div>
          <div style={{ fontSize: '0.9em', color: 'var(--color-text-secondary)' }}>
            {new Date(message.createdAt).toLocaleString()}
          </div>
        </div>
        <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
      </Card>
    );
  }

  return (
    <Card style={{ background: isCurrentUser ? 'var(--color-primary-bg)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-2)' }}>
        <div style={{ fontWeight: 'bold' }}>
          {authorName || (isCurrentUser ? 'You' : 'Support Team')}
        </div>
        <div style={{ fontSize: '0.9em', color: 'var(--color-text-secondary)' }}>
          {new Date(message.createdAt).toLocaleString()}
        </div>
      </div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
    </Card>
  );
}

