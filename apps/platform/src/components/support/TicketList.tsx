import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { SupportTicket } from '../../api/support';
import { supportApi } from '../../api/support';
import { Card } from '../shared/Card';

interface TicketListProps {
  filter?: {
    status?: SupportTicket['status'];
    priority?: SupportTicket['priority'];
  };
}

const statusColors: Record<SupportTicket['status'], string> = {
  open: 'var(--color-success)',
  in_progress: 'var(--color-primary)',
  resolved: 'var(--color-text-secondary)',
  closed: 'var(--color-text-secondary)',
};

const priorityColors: Record<SupportTicket['priority'], string> = {
  low: 'var(--color-text-secondary)',
  medium: 'var(--color-primary)',
  high: 'var(--color-warning)',
  urgent: 'var(--color-error)',
};

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
      <div>
        <p>Loading tickets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <p style={{ color: 'var(--color-error)' }}>{error}</p>
      </Card>
    );
  }

  if (tickets.length === 0) {
    return (
      <Card>
        <p style={{ color: 'var(--color-text-secondary)' }}>No tickets found.</p>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
      {tickets.map((ticket) => (
        <Link key={ticket.id} to={`/support/tickets/${ticket.id}`} style={{ textDecoration: 'none' }}>
          <Card hoverable>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--spacing-3)' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, marginBottom: 'var(--spacing-1)' }}>{ticket.title}</h3>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.9em' }}>
                  {ticket.description.substring(0, 150)}
                  {ticket.description.length > 150 ? '...' : ''}
                </p>
                <div style={{ marginTop: 'var(--spacing-2)', display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      padding: 'var(--spacing-1) var(--spacing-2)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85em',
                      background: statusColors[ticket.status] + '20',
                      color: statusColors[ticket.status],
                      textTransform: 'capitalize',
                    }}
                  >
                    {ticket.status.replace('_', ' ')}
                  </span>
                  <span
                    style={{
                      padding: 'var(--spacing-1) var(--spacing-2)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85em',
                      background: priorityColors[ticket.priority] + '20',
                      color: priorityColors[ticket.priority],
                      textTransform: 'capitalize',
                    }}
                  >
                    {ticket.priority}
                  </span>
                  <span
                    style={{
                      padding: 'var(--spacing-1) var(--spacing-2)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85em',
                      background: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-secondary)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {ticket.type}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: '0.9em', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                {new Date(ticket.createdAt).toLocaleDateString()}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

