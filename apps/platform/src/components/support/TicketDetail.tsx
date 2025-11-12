import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Layout } from '../layout/Layout';
import type { SupportTicketWithMessages } from '../../api/support';
import { supportApi } from '../../api/support';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { TicketMessage } from './TicketMessage';

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<SupportTicketWithMessages | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      loadTicket();
    }
  }, [id]);

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
      alert(err instanceof Error ? err.message : 'Failed to add message');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!id || !ticket) return;
    if (!confirm('Are you sure you want to close this ticket?')) return;

    try {
      await supportApi.updateTicket(id, { status: 'closed' });
      await loadTicket();
    } catch (err) {
      console.error('Failed to close ticket:', err);
      alert(err instanceof Error ? err.message : 'Failed to close ticket');
    }
  };

  if (loading) {
    return (
      <div>
        <p>Loading ticket...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <Card>
        <p style={{ color: 'var(--color-error)' }}>{error || 'Ticket not found'}</p>
        <Button onClick={() => navigate('/support')}>Back to Support</Button>
      </Card>
    );
  }

  const isCurrentUser = ticket.userId === user?.id;
  const canClose = isCurrentUser && ticket.status !== 'closed';

  return (
    <Layout>
      <div className="page-container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-3)' }}>
          <div>
            <h1 style={{ margin: 0, marginBottom: 'var(--spacing-2)' }}>{ticket.title}</h1>
            <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
              <span style={{ padding: 'var(--spacing-1) var(--spacing-2)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-secondary)', fontSize: '0.9em' }}>
                {ticket.status.replace('_', ' ')}
              </span>
              <span style={{ padding: 'var(--spacing-1) var(--spacing-2)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-secondary)', fontSize: '0.9em' }}>
                {ticket.priority}
              </span>
              <span style={{ padding: 'var(--spacing-1) var(--spacing-2)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-secondary)', fontSize: '0.9em' }}>
                {ticket.type}
              </span>
            </div>
          </div>
          {canClose && (
            <Button onClick={handleCloseTicket} variant="secondary">
              Close Ticket
            </Button>
          )}
        </div>
        <div style={{ whiteSpace: 'pre-wrap', marginTop: 'var(--spacing-3)' }}>{ticket.description}</div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
        <h2>Messages</h2>
        {ticket.messages.length === 0 ? (
          <Card>
            <p style={{ color: 'var(--color-text-secondary)' }}>No messages yet.</p>
          </Card>
        ) : (
          ticket.messages.map((message) => (
            <TicketMessage
              key={message.id}
              message={message}
              isCurrentUser={message.authorId === user?.id}
            />
          ))
        )}
      </div>

      {ticket.status !== 'closed' && (
        <Card>
          <form onSubmit={handleAddMessage}>
            <h3 style={{ marginTop: 0 }}>Add Message</h3>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={4}
              required
              style={{ width: '100%', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontFamily: 'inherit', resize: 'vertical', marginBottom: 'var(--spacing-2)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" disabled={submitting || !newMessage.trim()}>
                {submitting ? 'Sending...' : 'Send Message'}
              </Button>
            </div>
          </form>
        </Card>
      )}
      </div>
      </div>
    </Layout>
  );
}

