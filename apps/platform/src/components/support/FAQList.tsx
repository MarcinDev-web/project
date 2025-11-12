import { useState, useEffect } from 'react';
import type { SupportFAQ } from '../../api/support';
import { supportApi } from '../../api/support';
import { FAQItem } from './FAQItem';
import { Card } from '../shared/Card';

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
      <div>
        <p>Loading FAQs...</p>
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

  if (faqs.length === 0) {
    return (
      <Card>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          {searchQuery ? 'No FAQs found matching your search.' : 'No FAQs available in this category.'}
        </p>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
      {faqs.map((faq) => (
        <FAQItem key={faq.id} faq={faq} onHelpful={loadFAQs} />
      ))}
    </div>
  );
}

