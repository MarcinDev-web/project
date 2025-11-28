import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { SupportFAQ } from '../../api/support';
import { supportApi } from '../../api/support';

interface FAQItemProps {
  faq: SupportFAQ;
  onHelpful?: () => void;
  style?: CSSProperties;
}

export function FAQItem({ faq, onHelpful, style }: FAQItemProps) {
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
    <div 
      className={`faq-item ${isExpanded ? 'faq-item--expanded' : ''}`}
      style={style}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="faq-item__header">
        <div className="faq-item__question-icon">
          {isExpanded ? '📖' : '❓'}
        </div>
        <h3 className="faq-item__question">{faq.question}</h3>
        <div className="faq-item__toggle">
          {isExpanded ? '−' : '+'}
        </div>
      </div>
      
      {isExpanded && (
        <div className="faq-item__content">
          <div className="faq-item__answer">
            {faq.answer}
          </div>
          <div className="faq-item__footer">
            <div className="faq-item__stats">
              <span className="faq-item__stat">
                <span className="faq-item__stat-icon">👁️</span>
                {faq.viewCount} views
              </span>
              <span className="faq-item__stat">
                <span className="faq-item__stat-icon">👍</span>
                {faq.helpfulCount} helpful
              </span>
            </div>
            <button
              className={`faq-item__helpful-btn ${isMarkingHelpful ? 'faq-item__helpful-btn--loading' : ''}`}
              onClick={handleMarkHelpful}
              disabled={isMarkingHelpful}
            >
              {isMarkingHelpful ? '...' : '👍 Helpful'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

