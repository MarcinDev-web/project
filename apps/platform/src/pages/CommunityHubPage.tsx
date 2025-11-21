import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { MessagesTab } from '../components/community-hub/MessagesTab';
import { FriendsTab } from '../components/community-hub/FriendsTab';
import { CommunityTab } from '../components/community-hub/CommunityTab';
import { NewsTab } from '../components/community-hub/NewsTab';

type TabType = 'messages' | 'friends' | 'community' | 'news';

export function CommunityHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(tabParam || 'community');

  useEffect(() => {
    // Sync URL with active tab
    if (tabParam && ['messages', 'friends', 'community', 'news'].includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (!tabParam) {
      // If no tab param, default to community and update URL
      setSearchParams({ tab: 'community' }, { replace: true });
    }
  }, [tabParam, setSearchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <Layout>
      <div className="page-container">
        <div className="community-hub-header">
          <h1>Community Hub</h1>
        </div>

        {/* Tab Navigation */}
        <nav className="community-hub-tabs" role="tablist" aria-label="Community sections">
          <button
            role="tab"
            aria-selected={activeTab === 'community'}
            aria-controls="community-panel"
            onClick={() => handleTabChange('community')}
            className={`community-hub-tab ${activeTab === 'community' ? 'community-hub-tab--active' : ''}`}
          >
            <span className="community-hub-tab__icon">💬</span>
            <span className="community-hub-tab__label">Forum</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'news'}
            aria-controls="news-panel"
            onClick={() => handleTabChange('news')}
            className={`community-hub-tab ${activeTab === 'news' ? 'community-hub-tab--active' : ''}`}
          >
            <span className="community-hub-tab__icon">📰</span>
            <span className="community-hub-tab__label">News</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'friends'}
            aria-controls="friends-panel"
            onClick={() => handleTabChange('friends')}
            className={`community-hub-tab ${activeTab === 'friends' ? 'community-hub-tab--active' : ''}`}
          >
            <span className="community-hub-tab__icon">👥</span>
            <span className="community-hub-tab__label">Friends</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'messages'}
            aria-controls="messages-panel"
            onClick={() => handleTabChange('messages')}
            className={`community-hub-tab ${activeTab === 'messages' ? 'community-hub-tab--active' : ''}`}
          >
            <span className="community-hub-tab__icon">💬</span>
            <span className="community-hub-tab__label">Messages</span>
          </button>
        </nav>

        {/* Tab Content */}
        <div className="community-hub-content">
          {activeTab === 'community' && (
            <div id="community-panel" role="tabpanel" aria-labelledby="community-tab">
              <CommunityTab />
            </div>
          )}
          {activeTab === 'news' && (
            <div id="news-panel" role="tabpanel" aria-labelledby="news-tab">
              <NewsTab />
            </div>
          )}
          {activeTab === 'friends' && (
            <div id="friends-panel" role="tabpanel" aria-labelledby="friends-tab">
              <FriendsTab />
            </div>
          )}
          {activeTab === 'messages' && (
            <div id="messages-panel" role="tabpanel" aria-labelledby="messages-tab">
              <MessagesTab />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

