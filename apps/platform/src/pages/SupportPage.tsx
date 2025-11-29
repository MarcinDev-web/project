/**
 * Support Page
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/shared/Button';
import { FAQList } from '../components/support/FAQList';
import { TicketForm } from '../components/support/TicketForm';
import { TicketList } from '../components/support/TicketList';
import type { SupportTicket, SupportFAQ, SupportTicketStats } from '../api/support';
import { supportApi } from '../api/support';
import '../styles/support-authenticated.css';

type Tab = 'faq' | 'create' | 'tickets';

// FAQ Category configuration
const FAQ_CATEGORIES: Array<{
  id: SupportFAQ['category'] | undefined;
  label: string;
  icon: string;
}> = [
  { id: undefined, label: 'All', icon: '📚' },
  { id: 'general', label: 'General', icon: '💡' },
  { id: 'editor', label: 'Editor', icon: '🎮' },
  { id: 'marketplace', label: 'Marketplace', icon: '🛒' },
  { id: 'account', label: 'Account', icon: '👤' },
  { id: 'technical', label: 'Technical', icon: '⚙️' },
];

// Guest Support Page Component
function GuestSupportPage() {
  const [faqCategory, setFaqCategory] = useState<SupportFAQ['category'] | undefined>();
  const [faqSearch, setFaqSearch] = useState('');

  return (
    <div className="support-fade-in">
      {/* Hero Section */}
      <section className="support-hero">
        <div className="support-hero__content">
          <div className="support-hero__icon">🛠️</div>
          <h1 className="support-hero__title">How Can We Help?</h1>
          <p className="support-hero__subtitle">
            Find answers to common questions, explore our resources, or get in touch with our support team.
          </p>
          <div className="support-hero__cta-group">
            <Link to="/login" className="support-hero__cta support-hero__cta--primary">
              <span>🔑</span>
              Sign In for Full Support
            </Link>
            <a href="#faq" className="support-hero__cta support-hero__cta--secondary">
              <span>📖</span>
              Browse FAQ
            </a>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="support-content">
        {/* Main Column */}
        <div className="support-main support-stagger">
          {/* Contact Cards */}
          <section className="support-contact-grid">
            <div className="support-contact-card support-contact-card--email">
              <div className="support-contact-card__icon">📧</div>
              <h3 className="support-contact-card__title">Email Support</h3>
              <p className="support-contact-card__description">
                Send us a detailed message and our team will get back to you as soon as possible.
              </p>
              <a href="mailto:support@playverse.gg" className="support-contact-card__link">
                support@playverse.gg
                <span className="support-contact-card__link-arrow">→</span>
              </a>
              <div className="support-contact-card__response">
                <span className="support-contact-card__response-icon">✓</span>
                Typically responds within 24 hours
              </div>
            </div>

            <div className="support-contact-card support-contact-card--discord">
              <div className="support-contact-card__icon">💬</div>
              <h3 className="support-contact-card__title">Community Discord</h3>
              <p className="support-contact-card__description">
                Join our Discord server to chat with the community and get help from fellow creators.
              </p>
              <a 
                href="https://discord.gg/playverse" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="support-contact-card__link"
              >
                Join Discord Server
                <span className="support-contact-card__link-arrow">→</span>
              </a>
              <div className="support-contact-card__response">
                <span className="support-contact-card__response-icon">✓</span>
                Real-time community support
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section id="faq" className="support-faq-section">
            <div className="support-faq-header">
              <div className="support-faq-header__title-group">
                <span className="support-faq-header__eyebrow">Knowledge Base</span>
                <h2 className="support-faq-header__title">Frequently Asked Questions</h2>
              </div>
              <div className="support-faq-categories">
                {FAQ_CATEGORIES.map((cat) => (
                  <button
                    key={cat.label}
                    className={`support-faq-category ${faqCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setFaqCategory(cat.id)}
                  >
                    <span className="support-faq-category__icon">{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="support-faq-search">
              <span className="support-faq-search__icon">🔍</span>
              <input
                type="text"
                className="support-faq-search__input"
                placeholder="Search for answers..."
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
              />
            </div>

            <div className="support-faq-list">
              <FAQList category={faqCategory} searchQuery={faqSearch || undefined} />
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="support-sidebar support-stagger">
          {/* System Status */}
          <div className="support-status">
            <div className="support-status__indicator" />
            <div className="support-status__text">
              <p className="support-status__title">All Systems Operational</p>
              <p className="support-status__description">Platform is running smoothly</p>
            </div>
          </div>

          {/* Login Prompt */}
          <div className="support-login-prompt">
            <div className="support-login-prompt__icon">🎫</div>
            <h3 className="support-login-prompt__title">Get Full Support Access</h3>
            <p className="support-login-prompt__description">
              Sign in to access all support features and track your requests.
            </p>
            <div className="support-login-prompt__features">
              <div className="support-login-prompt__feature">
                <span className="support-login-prompt__feature-icon">✓</span>
                Create and track support tickets
              </div>
              <div className="support-login-prompt__feature">
                <span className="support-login-prompt__feature-icon">✓</span>
                Get personalized assistance
              </div>
              <div className="support-login-prompt__feature">
                <span className="support-login-prompt__feature-icon">✓</span>
                Access priority support
              </div>
            </div>
            <Link to="/login" className="support-login-prompt__cta">
              Sign In Now
              <span>→</span>
            </Link>
          </div>

          {/* Quick Resources */}
          <div className="support-resources">
            <h3 className="support-resources__title">
              <span className="support-resources__title-icon">📚</span>
              Quick Resources
            </h3>
            <div className="support-resources__list">
              <Link to="/news" className="support-resource-link">
                <span className="support-resource-link__icon">📰</span>
                Latest News & Updates
                <span className="support-resource-link__arrow">›</span>
              </Link>
              <Link to="/marketplace" className="support-resource-link">
                <span className="support-resource-link__icon">🛒</span>
                Browse Marketplace
                <span className="support-resource-link__arrow">›</span>
              </Link>
              <a 
                href="https://docs.playverse.gg" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="support-resource-link"
              >
                <span className="support-resource-link__icon">📖</span>
                Documentation
                <span className="support-resource-link__arrow">›</span>
              </a>
              <a 
                href="https://status.playverse.gg" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="support-resource-link"
              >
                <span className="support-resource-link__icon">📊</span>
                System Status
                <span className="support-resource-link__arrow">›</span>
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// User Stats Component
function UserTicketStats() {
  const [stats, setStats] = useState<SupportTicketStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

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

  if (loading) {
    return (
      <div className="support-stats support-stats--loading">
        <div className="support-stats__loading">Loading stats...</div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="support-stats">
      <div className="support-stats__card support-stats__card--total">
        <span className="support-stats__icon">🎫</span>
        <div className="support-stats__content">
          <span className="support-stats__value">{stats.total}</span>
          <span className="support-stats__label">Total Tickets</span>
        </div>
      </div>
      <div className="support-stats__card support-stats__card--open">
        <span className="support-stats__icon">🟢</span>
        <div className="support-stats__content">
          <span className="support-stats__value">{stats.open}</span>
          <span className="support-stats__label">Open</span>
        </div>
      </div>
      <div className="support-stats__card support-stats__card--progress">
        <span className="support-stats__icon">🔄</span>
        <div className="support-stats__content">
          <span className="support-stats__value">{stats.inProgress}</span>
          <span className="support-stats__label">In Progress</span>
        </div>
      </div>
      <div className="support-stats__card support-stats__card--resolved">
        <span className="support-stats__icon">✅</span>
        <div className="support-stats__content">
          <span className="support-stats__value">{stats.resolved + stats.closed}</span>
          <span className="support-stats__label">Resolved</span>
        </div>
      </div>
    </div>
  );
}

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
        {isAuthenticated ? (
          <div className="support-auth">
            {/* Header */}
            <div className="support-auth__header">
              <div className="support-auth__header-content">
                <h1 className="support-auth__title">
                  <span className="support-auth__title-icon">🛠️</span>
                  Support Center
                </h1>
                <p className="support-auth__subtitle">
                  Find answers, create tickets, and track your requests
                </p>
              </div>
              <Button onClick={() => setActiveTab('create')} variant={activeTab === 'create' ? 'secondary' : 'primary'}>
                <span style={{ marginRight: '8px' }}>➕</span>
                New Ticket
              </Button>
            </div>

            {/* Stats */}
            <UserTicketStats />

            {/* Navigation Tabs */}
            <div className="support-auth__tabs">
              <button
                className={`support-auth__tab ${activeTab === 'faq' ? 'support-auth__tab--active' : ''}`}
                onClick={() => setActiveTab('faq')}
              >
                <span className="support-auth__tab-icon">📖</span>
                FAQ
              </button>
              <button
                className={`support-auth__tab ${activeTab === 'create' ? 'support-auth__tab--active' : ''}`}
                onClick={() => setActiveTab('create')}
              >
                <span className="support-auth__tab-icon">✏️</span>
                Create Ticket
              </button>
              <button
                className={`support-auth__tab ${activeTab === 'tickets' ? 'support-auth__tab--active' : ''}`}
                onClick={() => setActiveTab('tickets')}
              >
                <span className="support-auth__tab-icon">🎫</span>
                My Tickets
              </button>
            </div>

            {/* Tab Content */}
            <div className="support-auth__content">
              {activeTab === 'faq' && (
                <div className="support-auth__faq">
                  {/* FAQ Search & Filters */}
                  <div className="support-auth__faq-filters">
                    <div className="support-auth__faq-search">
                      <span className="support-auth__faq-search-icon">🔍</span>
                      <input
                        id="faq-search"
                        type="text"
                        value={faqSearch}
                        onChange={(e) => setFaqSearch(e.target.value)}
                        placeholder="Search for answers..."
                        className="support-auth__faq-search-input"
                      />
                    </div>
                    <div className="support-auth__faq-categories">
                      {FAQ_CATEGORIES.map((cat) => (
                        <button
                          key={cat.label}
                          className={`support-auth__faq-category ${faqCategory === cat.id ? 'support-auth__faq-category--active' : ''}`}
                          onClick={() => setFaqCategory(cat.id)}
                        >
                          <span>{cat.icon}</span>
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <FAQList category={faqCategory} searchQuery={faqSearch || undefined} />
                </div>
              )}

              {activeTab === 'create' && (
                <TicketForm onSuccess={handleTicketCreated} />
              )}

              {activeTab === 'tickets' && (
                <div className="support-auth__tickets">
                  {/* Ticket Filters */}
                  <div className="support-auth__ticket-filters">
                    <span className="support-auth__ticket-filters-label">Filter:</span>
                    <div className="support-auth__ticket-status-filters">
                      <button
                        className={`support-auth__status-btn ${!ticketFilter.status ? 'support-auth__status-btn--active' : ''}`}
                        onClick={() => setTicketFilter({})}
                      >
                        All
                      </button>
                      <button
                        className={`support-auth__status-btn ${ticketFilter.status === 'open' ? 'support-auth__status-btn--active' : ''}`}
                        onClick={() => setTicketFilter({ status: 'open' })}
                      >
                        🟢 Open
                      </button>
                      <button
                        className={`support-auth__status-btn ${ticketFilter.status === 'in_progress' ? 'support-auth__status-btn--active' : ''}`}
                        onClick={() => setTicketFilter({ status: 'in_progress' })}
                      >
                        🔄 In Progress
                      </button>
                      <button
                        className={`support-auth__status-btn ${ticketFilter.status === 'resolved' ? 'support-auth__status-btn--active' : ''}`}
                        onClick={() => setTicketFilter({ status: 'resolved' })}
                      >
                        ✅ Resolved
                      </button>
                      <button
                        className={`support-auth__status-btn ${ticketFilter.status === 'closed' ? 'support-auth__status-btn--active' : ''}`}
                        onClick={() => setTicketFilter({ status: 'closed' })}
                      >
                        🔒 Closed
                      </button>
                    </div>
                  </div>
                  <TicketList filter={ticketFilter} />
                </div>
              )}
            </div>

            {/* Quick Help */}
            <div className="support-auth__quick-help">
              <h3 className="support-auth__quick-help-title">Need more help?</h3>
              <div className="support-auth__quick-help-links">
                <a href="https://discord.gg/playverse" target="_blank" rel="noopener noreferrer" className="support-auth__quick-help-link">
                  <span>💬</span> Join Discord
                </a>
                <a href="https://docs.playverse.gg" target="_blank" rel="noopener noreferrer" className="support-auth__quick-help-link">
                  <span>📚</span> Documentation
                </a>
                <a href="mailto:support@playverse.gg" className="support-auth__quick-help-link">
                  <span>📧</span> Email Support
                </a>
              </div>
            </div>
          </div>
        ) : (
          <GuestSupportPage />
        )}
      </div>
    </Layout>
  );
}

