/**
 * Support Page
 */

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';
import { Button } from '../components/shared/Button';
import { FAQList } from '../components/support/FAQList';
import { TicketForm } from '../components/support/TicketForm';
import { TicketList } from '../components/support/TicketList';
import type { SupportTicket } from '../api/support';
import { useNavigate } from 'react-router-dom';

type Tab = 'faq' | 'create' | 'tickets';

export function SupportPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('faq');
  const [faqCategory, setFaqCategory] = useState<'general' | 'editor' | 'marketplace' | 'account' | 'technical' | undefined>();
  const [faqSearch, setFaqSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState<{ status?: SupportTicket['status'] }>({});

  const handleTicketCreated = (ticket: SupportTicket) => {
    navigate(`/support/tickets/${ticket.id}`);
  };

  return (
    <Layout>
      <div className="page-container">
        <h1>Support</h1>
        
        {isAuthenticated ? (
          <div style={{ marginTop: 'var(--spacing-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--spacing-3)' }}>
              <Button
                variant={activeTab === 'faq' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('faq')}
              >
                FAQ
              </Button>
              <Button
                variant={activeTab === 'create' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('create')}
              >
                Create Ticket
              </Button>
              <Button
                variant={activeTab === 'tickets' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('tickets')}
              >
                My Tickets
              </Button>
            </div>

            {activeTab === 'faq' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
                <Card>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                    <div>
                      <label htmlFor="faq-search" style={{ display: 'block', marginBottom: 'var(--spacing-1)' }}>
                        Search FAQ
                      </label>
                      <input
                        id="faq-search"
                        type="text"
                        value={faqSearch}
                        onChange={(e) => setFaqSearch(e.target.value)}
                        placeholder="Search for answers..."
                        style={{ width: '100%', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="faq-category" style={{ display: 'block', marginBottom: 'var(--spacing-1)' }}>
                        Category
                      </label>
                      <select
                        id="faq-category"
                        value={faqCategory || ''}
                        onChange={(e) => setFaqCategory(e.target.value as typeof faqCategory || undefined)}
                        style={{ width: '100%', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                      >
                        <option value="">All Categories</option>
                        <option value="general">General</option>
                        <option value="editor">Editor</option>
                        <option value="marketplace">Marketplace</option>
                        <option value="account">Account</option>
                        <option value="technical">Technical</option>
                      </select>
                    </div>
                  </div>
                </Card>
                <FAQList category={faqCategory} searchQuery={faqSearch || undefined} />
              </div>
            )}

            {activeTab === 'create' && (
              <TicketForm onSuccess={handleTicketCreated} />
            )}

            {activeTab === 'tickets' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
                <Card>
                  <div>
                    <label htmlFor="ticket-status-filter" style={{ display: 'block', marginBottom: 'var(--spacing-1)' }}>
                      Filter by Status
                    </label>
                    <select
                      id="ticket-status-filter"
                      value={ticketFilter.status || ''}
                      onChange={(e) => setTicketFilter({ status: e.target.value as SupportTicket['status'] || undefined })}
                      style={{ width: '100%', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                    >
                      <option value="">All Statuses</option>
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </Card>
                <TicketList filter={ticketFilter} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', marginTop: 'var(--spacing-4)' }}>
            <Card>
              <h2>Need Help?</h2>
              <p>We're here to help! If you have any questions or need assistance, please reach out to us.</p>
              <p style={{ marginTop: 'var(--spacing-2)' }}>
                <a href="/login" style={{ color: 'var(--color-primary)' }}>Log in</a> to access the support system and create tickets.
              </p>
            </Card>
            
            <Card>
              <h3>Contact Us</h3>
              <p>Email: support@forge.world</p>
              <p>We typically respond within 24 hours.</p>
            </Card>
            
            <FAQList />
          </div>
        )}
      </div>
    </Layout>
  );
}

