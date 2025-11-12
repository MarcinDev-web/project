import { useState } from 'react';
import type { SupportTicket } from '../../api/support';
import { supportApi } from '../../api/support';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';

interface TicketFormProps {
  onSuccess?: (ticket: SupportTicket) => void;
  onCancel?: () => void;
}

export function TicketForm({ onSuccess, onCancel }: TicketFormProps) {
  const [type, setType] = useState<'bug' | 'question' | 'feature' | 'other'>('question');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const ticket = await supportApi.createTicket({
        type,
        priority,
        title: title.trim(),
        description: description.trim(),
      });
      onSuccess?.(ticket);
      // Reset form
      setTitle('');
      setDescription('');
      setType('question');
      setPriority('medium');
    } catch (err) {
      console.error('Failed to create ticket:', err);
      setError(err instanceof Error ? err.message : 'Failed to create ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <h2 style={{ marginTop: 0 }}>Create Support Ticket</h2>
        
        {error && (
          <div style={{ padding: 'var(--spacing-2)', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--spacing-3)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
          <div>
            <label htmlFor="ticket-type" style={{ display: 'block', marginBottom: 'var(--spacing-1)' }}>
              Type
            </label>
            <select
              id="ticket-type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              style={{ width: '100%', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
            >
              <option value="question">Question</option>
              <option value="bug">Bug Report</option>
              <option value="feature">Feature Request</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="ticket-priority" style={{ display: 'block', marginBottom: 'var(--spacing-1)' }}>
              Priority
            </label>
            <select
              id="ticket-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              style={{ width: '100%', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label htmlFor="ticket-title" style={{ display: 'block', marginBottom: 'var(--spacing-1)' }}>
              Title *
            </label>
            <input
              id="ticket-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of your issue"
              required
              style={{ width: '100%', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
            />
          </div>

          <div>
            <label htmlFor="ticket-description" style={{ display: 'block', marginBottom: 'var(--spacing-1)' }}>
              Description *
            </label>
            <textarea
              id="ticket-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide as much detail as possible..."
              required
              rows={8}
              style={{ width: '100%', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
            {onCancel && (
              <Button type="button" onClick={onCancel} variant="secondary">
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Ticket'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

