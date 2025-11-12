import { useState } from 'react';
import type { SupportFAQ } from '../../api/support';
import { supportApi } from '../../api/support';
import { Card } from '../shared/Card';

interface FAQItemProps {
  faq: SupportFAQ;
  onHelpful?: () => void;
}

export function FAQItem({ faq, onHelpful }: FAQItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMarkingHelpful, setIsMarkingHelpful] = useState(false);

  const handleMarkHelpful = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMarkingHelpful) return;

    try {
      setIsMarkingHelpful(true);
      await supportApi.markFAQHelpful(faq.id);
      onHelpful?.();
    } catch (error) {
      console.error('Failed to mark FAQ as helpful:', error);
    } finally {
      setIsMarkingHelpful(false);
    }
  };

  return (
    <Card className="faq-item" hoverable onClick={() => setIsExpanded(!isExpanded)}>
      <div style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--spacing-2)' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, marginBottom: 'var(--spacing-2)' }}>{faq.question}</h3>
            {isExpanded && (
              <div
                style={{
                  marginTop: 'var(--spacing-3)',
                  paddingTop: 'var(--spacing-3)',
                  borderTop: '1px solid var(--color-border)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {faq.answer}
              </div>
            )}
          </div>
          <div style={{ fontSize: '1.2em', color: 'var(--color-text-secondary)' }}>
            {isExpanded ? '−' : '+'}
          </div>
        </div>
        {isExpanded && (
          <div
            style={{
              marginTop: 'var(--spacing-3)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 'var(--spacing-2)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', gap: 'var(--spacing-3)', fontSize: '0.9em', color: 'var(--color-text-secondary)' }}>
              <span>{faq.viewCount} views</span>
              <span>{faq.helpfulCount} helpful</span>
            </div>
            <button
              onClick={handleMarkHelpful}
              disabled={isMarkingHelpful}
              style={{
                padding: 'var(--spacing-1) var(--spacing-2)',
                fontSize: '0.9em',
                background: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: isMarkingHelpful ? 'not-allowed' : 'pointer',
                opacity: isMarkingHelpful ? 0.6 : 1,
              }}
            >
              {isMarkingHelpful ? '...' : 'Helpful'}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

