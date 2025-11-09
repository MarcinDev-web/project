import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { MessagesTab } from '../components/community-hub/MessagesTab';
import { FriendsTab } from '../components/community-hub/FriendsTab';
import { CommunityTab } from '../components/community-hub/CommunityTab';

type TabType = 'messages' | 'friends' | 'community';

export function CommunityHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(tabParam || 'messages');

  useEffect(() => {
    // Sync URL with active tab
    if (tabParam && ['messages', 'friends', 'community'].includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (!tabParam) {
      // If no tab param, default to messages and update URL
      setSearchParams({ tab: 'messages' }, { replace: true });
    }
  }, [tabParam, setSearchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <Layout>
      <div className="page-container">
        <h1 style={{ marginBottom: 'var(--spacing-6)' }}>Community OS</h1>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-2)',
          marginBottom: 'var(--spacing-6)',
          borderBottom: '1px solid var(--border-default)',
        }}>
          <button
            onClick={() => handleTabChange('messages')}
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'messages' ? 'var(--text-1)' : 'var(--text-2)',
              borderBottom: activeTab === 'messages' ? '2px solid var(--bg-button-primary)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 'var(--text-base)',
              fontWeight: activeTab === 'messages' ? 'var(--font-semibold)' : 'var(--font-normal)',
            }}
          >
            💬 Messages
          </button>
          <button
            onClick={() => handleTabChange('friends')}
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'friends' ? 'var(--text-1)' : 'var(--text-2)',
              borderBottom: activeTab === 'friends' ? '2px solid var(--bg-button-primary)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 'var(--text-base)',
              fontWeight: activeTab === 'friends' ? 'var(--font-semibold)' : 'var(--font-normal)',
            }}
          >
            👥 Friends
          </button>
          <button
            onClick={() => handleTabChange('community')}
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'community' ? 'var(--text-1)' : 'var(--text-2)',
              borderBottom: activeTab === 'community' ? '2px solid var(--bg-button-primary)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 'var(--text-base)',
              fontWeight: activeTab === 'community' ? 'var(--font-semibold)' : 'var(--font-normal)',
            }}
          >
            💬 Community
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'messages' && <MessagesTab />}
        {activeTab === 'friends' && <FriendsTab />}
        {activeTab === 'community' && <CommunityTab />}
      </div>
    </Layout>
  );
}

