import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Card } from '../../components/shared/Card';
import { Button } from '../../components/shared/Button';
import type { SupportTicket, SupportTicketStats, SupportFAQ } from '../../api/support';
import { supportApi } from '../../api/support';
import { TicketMessage } from '../../components/support/TicketMessage';
import { useAuth } from '../../contexts/AuthContext';

type Tab = 'dashboard' | 'tickets' | 'faq';

export function SupportManagementPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<SupportTicketStats | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketDetails, setTicketDetails] = useState<{ ticket: SupportTicket; messages: any[] } | null>(null);
  const [faqs, setFaqs] = useState<SupportFAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketFilters, setTicketFilters] = useState<{
    status?: SupportTicket['status'];
    priority?: SupportTicket['priority'];
    assignedTo?: string;
  }>({});
  const [newMessage, setNewMessage] = useState('');
  const [submittingMessage, setSubmittingMessage] = useState(false);
  const [faqForm, setFaqForm] = useState<{
    question: string;
    answer: string;
    category: SupportFAQ['category'];
    order: number;
    isPublished: boolean;
    tags: string[];
  }>({
    question: '',
    answer: '',
    category: 'general',
    order: 999,
    isPublished: false,
    tags: [],
  });
  const [editingFAQ, setEditingFAQ] = useState<SupportFAQ | null>(null);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadStats();
    } else if (activeTab === 'tickets') {
      loadTickets();
    } else if (activeTab === 'faq') {
      loadFAQs();
    }
  }, [activeTab, ticketFilters]);

  useEffect(() => {
    if (selectedTicket) {
      loadTicketDetails(selectedTicket.id);
    }
  }, [selectedTicket]);

  const loadStats = async () => {
    try {
      const data = await supportApi.getTicketStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await supportApi.getAdminTickets(ticketFilters);
      setTickets(data);
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTicketDetails = async (id: string) => {
    try {
      const data = await supportApi.getTicket(id);
      setTicketDetails({ ticket: data, messages: data.messages });
    } catch (error) {
      console.error('Failed to load ticket details:', error);
    }
  };

  const loadFAQs = async () => {
    try {
      setLoading(true);
      const data = await supportApi.getFAQs({ isPublished: undefined }); // Get all FAQs
      setFaqs(data);
    } catch (error) {
      console.error('Failed to load FAQs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTicket = async (id: string, updates: {
    status?: SupportTicket['status'];
    priority?: SupportTicket['priority'];
    assignedTo?: string | null;
  }) => {
    try {
      await supportApi.updateAdminTicket(id, updates);
      await loadTickets();
      if (selectedTicket?.id === id) {
        await loadTicketDetails(id);
      }
    } catch (error) {
      console.error('Failed to update ticket:', error);
      alert('Failed to update ticket');
    }
  };

  const handleAddMessage = async (ticketId: string) => {
    if (!newMessage.trim()) return;

    try {
      setSubmittingMessage(true);
      await supportApi.addMessage(ticketId, { content: newMessage.trim(), isInternal: false });
      setNewMessage('');
      await loadTicketDetails(ticketId);
    } catch (error) {
      console.error('Failed to add message:', error);
      alert('Failed to add message');
    } finally {
      setSubmittingMessage(false);
    }
  };

  const handleSaveFAQ = async () => {
    try {
      if (editingFAQ) {
        await supportApi.updateFAQ(editingFAQ.id, faqForm);
      } else {
        await supportApi.createFAQ(faqForm);
      }
      setFaqForm({ question: '', answer: '', category: 'general', order: 999, isPublished: false, tags: [] });
      setEditingFAQ(null);
      await loadFAQs();
    } catch (error) {
      console.error('Failed to save FAQ:', error);
      alert('Failed to save FAQ');
    }
  };

  const handleDeleteFAQ = async (id: string) => {
    if (!confirm('Are you sure you want to delete this FAQ?')) return;

    try {
      await supportApi.deleteFAQ(id);
      await loadFAQs();
    } catch (error) {
      console.error('Failed to delete FAQ:', error);
      alert('Failed to delete FAQ');
    }
  };

  return (
    <Layout>
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Support Management</h1>

        <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--spacing-3)' }}>
          <Button variant={activeTab === 'dashboard' ? 'primary' : 'secondary'} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </Button>
          <Button variant={activeTab === 'tickets' ? 'primary' : 'secondary'} onClick={() => setActiveTab('tickets')}>
            Tickets
          </Button>
          <Button variant={activeTab === 'faq' ? 'primary' : 'secondary'} onClick={() => setActiveTab('faq')}>
            FAQ Management
          </Button>
        </div>

        {activeTab === 'dashboard' && stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
            <Card>
              <h3 style={{ margin: 0, marginBottom: 'var(--spacing-1)' }}>Total Tickets</h3>
              <div style={{ fontSize: '2em', fontWeight: 'bold' }}>{stats.total}</div>
            </Card>
            <Card>
              <h3 style={{ margin: 0, marginBottom: 'var(--spacing-1)' }}>Open</h3>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: 'var(--color-success)' }}>{stats.open}</div>
            </Card>
            <Card>
              <h3 style={{ margin: 0, marginBottom: 'var(--spacing-1)' }}>In Progress</h3>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: 'var(--color-primary)' }}>{stats.inProgress}</div>
            </Card>
            <Card>
              <h3 style={{ margin: 0, marginBottom: 'var(--spacing-1)' }}>Resolved</h3>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: 'var(--color-text-secondary)' }}>{stats.resolved}</div>
            </Card>
            {stats.averageResponseTime !== undefined && (
              <Card>
                <h3 style={{ margin: 0, marginBottom: 'var(--spacing-1)' }}>Avg Response</h3>
                <div style={{ fontSize: '2em', fontWeight: 'bold' }}>{stats.averageResponseTime.toFixed(1)}h</div>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'tickets' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedTicket ? '1fr 2fr' : '1fr', gap: 'var(--spacing-4)' }}>
            <div>
              <Card style={{ marginBottom: 'var(--spacing-3)' }}>
                <h3 style={{ marginTop: 0 }}>Filters</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                  <select
                    value={ticketFilters.status || ''}
                    onChange={(e) => setTicketFilters({ ...ticketFilters, status: e.target.value as SupportTicket['status'] || undefined })}
                    style={{ padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                  >
                    <option value="">All Statuses</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <select
                    value={ticketFilters.priority || ''}
                    onChange={(e) => setTicketFilters({ ...ticketFilters, priority: e.target.value as SupportTicket['priority'] || undefined })}
                    style={{ padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                  >
                    <option value="">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </Card>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                {tickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    hoverable
                    onClick={() => setSelectedTicket(ticket)}
                    style={{ cursor: 'pointer', background: selectedTicket?.id === ticket.id ? 'var(--color-primary-bg)' : undefined }}
                  >
                    <div>
                      <h4 style={{ margin: 0, marginBottom: 'var(--spacing-1)' }}>{ticket.title}</h4>
                      <div style={{ fontSize: '0.9em', color: 'var(--color-text-secondary)' }}>
                        {ticket.status} • {ticket.priority}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {selectedTicket && ticketDetails && (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-3)' }}>
                  <div>
                    <h2 style={{ margin: 0, marginBottom: 'var(--spacing-2)' }}>{ticketDetails.ticket.title}</h2>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap', marginBottom: 'var(--spacing-2)' }}>
                      <select
                        value={ticketDetails.ticket.status}
                        onChange={(e) => handleUpdateTicket(ticketDetails.ticket.id, { status: e.target.value as SupportTicket['status'] })}
                        style={{ padding: 'var(--spacing-1) var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                      <select
                        value={ticketDetails.ticket.priority}
                        onChange={(e) => handleUpdateTicket(ticketDetails.ticket.id, { priority: e.target.value as SupportTicket['priority'] })}
                        style={{ padding: 'var(--spacing-1) var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ whiteSpace: 'pre-wrap', marginBottom: 'var(--spacing-4)', paddingBottom: 'var(--spacing-4)', borderBottom: '1px solid var(--color-border)' }}>
                  {ticketDetails.ticket.description}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
                  <h3>Messages</h3>
                  {ticketDetails.messages.map((msg) => (
                    <TicketMessage key={msg.id} message={msg} isCurrentUser={msg.authorId === user?.id} />
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddMessage(ticketDetails.ticket.id);
                  }}
                >
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Add a message..."
                    rows={4}
                    required
                    style={{ width: '100%', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontFamily: 'inherit', marginBottom: 'var(--spacing-2)' }}
                  />
                  <Button type="submit" disabled={submittingMessage || !newMessage.trim()}>
                    {submittingMessage ? 'Sending...' : 'Send Message'}
                  </Button>
                </form>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'faq' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
            <div>
              <Card style={{ marginBottom: 'var(--spacing-3)' }}>
                <h3 style={{ marginTop: 0 }}>{editingFAQ ? 'Edit FAQ' : 'Create FAQ'}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                  <input
                    type="text"
                    placeholder="Question"
                    value={faqForm.question}
                    onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                    style={{ padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                  />
                  <textarea
                    placeholder="Answer"
                    value={faqForm.answer}
                    onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                    rows={6}
                    style={{ padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontFamily: 'inherit' }}
                  />
                  <select
                    value={faqForm.category}
                    onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value as SupportFAQ['category'] })}
                    style={{ padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                  >
                    <option value="general">General</option>
                    <option value="editor">Editor</option>
                    <option value="marketplace">Marketplace</option>
                    <option value="account">Account</option>
                    <option value="technical">Technical</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Order"
                    value={faqForm.order}
                    onChange={(e) => setFaqForm({ ...faqForm, order: parseInt(e.target.value) || 999 })}
                    style={{ padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                    <input
                      type="checkbox"
                      checked={faqForm.isPublished}
                      onChange={(e) => setFaqForm({ ...faqForm, isPublished: e.target.checked })}
                    />
                    Published
                  </label>
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                    <Button onClick={handleSaveFAQ} disabled={!faqForm.question.trim() || !faqForm.answer.trim()}>
                      {editingFAQ ? 'Update' : 'Create'}
                    </Button>
                    {editingFAQ && (
                      <Button variant="secondary" onClick={() => { setEditingFAQ(null); setFaqForm({ question: '', answer: '', category: 'general', order: 999, isPublished: false, tags: [] }); }}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            <div>
              <h3>Existing FAQs</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                {faqs.map((faq) => (
                  <Card key={faq.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, marginBottom: 'var(--spacing-1)' }}>{faq.question}</h4>
                        <div style={{ fontSize: '0.9em', color: 'var(--color-text-secondary)' }}>
                          {faq.category} • {faq.isPublished ? 'Published' : 'Draft'} • {faq.viewCount} views
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                        <Button size="small" variant="secondary" onClick={() => { setEditingFAQ(faq); setFaqForm({ question: faq.question, answer: faq.answer, category: faq.category, order: faq.order, isPublished: faq.isPublished, tags: faq.tags }); }}>
                          Edit
                        </Button>
                        <Button size="small" variant="danger" onClick={() => handleDeleteFAQ(faq.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

