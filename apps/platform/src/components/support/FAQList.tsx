import { useState, useEffect } from 'react';
import type { SupportFAQ } from '../../api/support';
import { supportApi } from '../../api/support';
import { FAQItem } from './FAQItem';

interface FAQListProps {
  category?: SupportFAQ['category'];
  searchQuery?: string;
}

export function FAQList({ category, searchQuery }: FAQListProps) {
  const [faqs, setFaqs] = useState<SupportFAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFAQs();
  }, [category, searchQuery]);

  const loadFAQs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = searchQuery
        ? await supportApi.searchFAQ(searchQuery)
        : await supportApi.getFAQs({ category });
      setFaqs(data);
    } catch (err) {
      console.error('Failed to load FAQs:', err);
      setError('Failed to load FAQs. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="faq-loading">
        <div className="faq-loading__spinner">⏳</div>
        <p className="faq-loading__text">Loading FAQs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="faq-error">
        <div className="faq-error__icon">⚠️</div>
        <p className="faq-error__text">{error}</p>
        <button className="faq-error__retry" onClick={loadFAQs}>
          Try Again
        </button>
      </div>
    );
  }

  if (faqs.length === 0) {
    return (
      <div className="support-faq-empty">
        <div className="support-faq-empty__icon">🔍</div>
        <p>
          {searchQuery 
            ? `No FAQs found matching "${searchQuery}". Try different keywords.` 
            : 'No FAQs available in this category yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="faq-items-list">
      {faqs.map((faq, index) => (
        <FAQItem 
          key={faq.id} 
          faq={faq} 
          onHelpful={loadFAQs} 
          style={{ animationDelay: `${index * 0.05}s` }}
        />
      ))}
    </div>
  );
}

