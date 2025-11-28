import { useState, useEffect, useMemo } from 'react';
import type { SupportTicket } from '../../api/support';
import { supportApi } from '../../api/support';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import './TicketForm.css';

interface TicketFormProps {
  onSuccess?: (ticket: SupportTicket) => void;
  onCancel?: () => void;
}

// Ticket type configuration
const TICKET_TYPES = [
  { value: 'question', label: 'Question', icon: '❓', description: 'Ask about how something works' },
  { value: 'bug', label: 'Bug Report', icon: '🐛', description: 'Report something that\'s broken' },
  { value: 'feature', label: 'Feature Request', icon: '💡', description: 'Suggest a new feature' },
  { value: 'other', label: 'Other', icon: '📝', description: 'Anything else' },
] as const;

// Priority configuration
const PRIORITIES = [
  { value: 'low', label: 'Low', icon: '🟢', description: 'No rush' },
  { value: 'medium', label: 'Medium', icon: '🟡', description: 'Normal priority' },
  { value: 'high', label: 'High', icon: '🟠', description: 'Important issue' },
  { value: 'urgent', label: 'Urgent', icon: '🔴', description: 'Critical - needs immediate attention' },
] as const;

interface FormErrors {
  title?: string;
  description?: string;
}

export function TicketForm({ onSuccess, onCancel }: TicketFormProps) {
  const [type, setType] = useState<'bug' | 'question' | 'feature' | 'other'>('question');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [success, setSuccess] = useState(false);

  // Validation
  const errors = useMemo<FormErrors>(() => {
    const e: FormErrors = {};
    if (touched.title && !title.trim()) {
      e.title = 'Title is required';
    } else if (touched.title && title.trim().length < 5) {
      e.title = 'Title must be at least 5 characters';
    } else if (touched.title && title.trim().length > 100) {
      e.title = 'Title must be less than 100 characters';
    }
    
    if (touched.description && !description.trim()) {
      e.description = 'Description is required';
    } else if (touched.description && description.trim().length < 20) {
      e.description = 'Please provide more detail (at least 20 characters)';
    }
    
    return e;
  }, [title, description, touched]);

  const isValid = title.trim().length >= 5 && description.trim().length >= 20;

  // Reset success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({ title: true, description: true });
    
    if (!isValid) {
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
      
      // Show success briefly before navigating
      setSuccess(true);
      
      // Reset form
      setTitle('');
      setDescription('');
      setType('question');
      setPriority('medium');
      setTouched({});
      
      // Call success callback after a brief delay
      setTimeout(() => {
        onSuccess?.(ticket);
      }, 500);
    } catch (err) {
      console.error('Failed to create ticket:', err);
      setError(err instanceof Error ? err.message : 'Failed to create ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = TICKET_TYPES.find(t => t.value === type);
  const selectedPriority = PRIORITIES.find(p => p.value === priority);

  return (
    <div className="ticket-form-container">
      <Card>
        <form onSubmit={handleSubmit} className="ticket-form">
          <div className="ticket-form__header">
            <h2 className="ticket-form__title">
              <span className="ticket-form__title-icon">🎫</span>
              Create Support Ticket
            </h2>
            <p className="ticket-form__subtitle">
              Fill out the form below and our team will get back to you as soon as possible.
            </p>
          </div>
          
          {error && (
            <div className="ticket-form__error">
              <span className="ticket-form__error-icon">⚠️</span>
              {error}
            </div>
          )}

          {success && (
            <div className="ticket-form__success">
              <span className="ticket-form__success-icon">✅</span>
              Ticket created successfully! Redirecting...
            </div>
          )}

          <div className="ticket-form__content">
            {/* Type Selection */}
            <div className="ticket-form__field">
              <label className="ticket-form__label">
                What type of request is this?
              </label>
              <div className="ticket-form__type-grid">
                {TICKET_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={`ticket-form__type-option ${type === t.value ? 'ticket-form__type-option--selected' : ''}`}
                    onClick={() => setType(t.value)}
                  >
                    <span className="ticket-form__type-icon">{t.icon}</span>
                    <span className="ticket-form__type-label">{t.label}</span>
                    <span className="ticket-form__type-desc">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Selection */}
            <div className="ticket-form__field">
              <label className="ticket-form__label">
                Priority Level
              </label>
              <div className="ticket-form__priority-grid">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`ticket-form__priority-option ${priority === p.value ? 'ticket-form__priority-option--selected' : ''}`}
                    onClick={() => setPriority(p.value)}
                  >
                    <span className="ticket-form__priority-icon">{p.icon}</span>
                    <span className="ticket-form__priority-label">{p.label}</span>
                  </button>
                ))}
              </div>
              {selectedPriority && (
                <p className="ticket-form__priority-hint">{selectedPriority.description}</p>
              )}
            </div>

            {/* Title Input */}
            <div className="ticket-form__field">
              <label htmlFor="ticket-title" className="ticket-form__label">
                Title <span className="ticket-form__required">*</span>
              </label>
              <input
                id="ticket-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => handleBlur('title')}
                placeholder="Brief description of your issue"
                className={`ticket-form__input ${errors.title ? 'ticket-form__input--error' : ''}`}
                maxLength={100}
              />
              <div className="ticket-form__input-footer">
                {errors.title ? (
                  <span className="ticket-form__field-error">{errors.title}</span>
                ) : (
                  <span className="ticket-form__field-hint">
                    Be specific - helps us understand your issue faster
                  </span>
                )}
                <span className="ticket-form__char-count">{title.length}/100</span>
              </div>
            </div>

            {/* Description Input */}
            <div className="ticket-form__field">
              <label htmlFor="ticket-description" className="ticket-form__label">
                Description <span className="ticket-form__required">*</span>
              </label>
              <textarea
                id="ticket-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => handleBlur('description')}
                placeholder={type === 'bug' 
                  ? "Please describe:\n• What happened?\n• What did you expect?\n• Steps to reproduce\n• Browser/OS info"
                  : "Please provide as much detail as possible..."}
                className={`ticket-form__textarea ${errors.description ? 'ticket-form__textarea--error' : ''}`}
                rows={8}
              />
              <div className="ticket-form__input-footer">
                {errors.description ? (
                  <span className="ticket-form__field-error">{errors.description}</span>
                ) : (
                  <span className="ticket-form__field-hint">
                    {type === 'bug' 
                      ? 'Include steps to reproduce, expected vs actual behavior'
                      : 'The more detail you provide, the better we can help'}
                  </span>
                )}
                <span className="ticket-form__char-count">{description.length} chars</span>
              </div>
            </div>

            {/* Summary */}
            <div className="ticket-form__summary">
              <div className="ticket-form__summary-item">
                <span className="ticket-form__summary-label">Type:</span>
                <span className="ticket-form__summary-value">
                  {selectedType?.icon} {selectedType?.label}
                </span>
              </div>
              <div className="ticket-form__summary-item">
                <span className="ticket-form__summary-label">Priority:</span>
                <span className="ticket-form__summary-value">
                  {selectedPriority?.icon} {selectedPriority?.label}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="ticket-form__actions">
              {onCancel && (
                <Button type="button" onClick={onCancel} variant="secondary">
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={submitting || !isValid}>
                {submitting ? (
                  <>
                    <span className="ticket-form__spinner">⏳</span>
                    Submitting...
                  </>
                ) : (
                  <>Submit Ticket</>
                )}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}

