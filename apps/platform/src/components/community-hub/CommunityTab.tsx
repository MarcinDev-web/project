import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ForumCategoryList } from '../community/ForumCategoryList';
import { ForumHeroSection } from './ForumHeroSection';
import { TrendingTopics } from './TrendingTopics';
import { ActivityFeed } from './ActivityFeed';
import { Leaderboard } from './Leaderboard';
import { TagsCloud } from './TagsCloud';
import { OnlineUsers } from './OnlineUsers';
import { forumApi, type ForumCategory } from '../../api/forum';
import { useAuth } from '../../contexts/AuthContext';

export function CommunityTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await forumApi.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewThread = () => {
    if (user) {
      navigate('/community/new-thread');
    } else {
      navigate('/login?redirect=/community/new-thread');
    }
  };

  return (
    <div className="forum-gaming-container">
      {/* Hero Section */}
      <ForumHeroSection onNewThread={handleNewThread} />

      {/* Main 3-column layout */}
      <div className="forum-gaming-layout">
        {/* Left Sidebar - Navigation & Tags */}
        <aside className="forum-gaming-layout__sidebar">
          {/* Quick Navigation */}
          <div className="forum-gaming-panel forum-quick-nav">
            <div className="forum-gaming-panel__header">
              <span className="forum-gaming-panel__icon">🧭</span>
              <h3 className="forum-gaming-panel__title">Quick Nav</h3>
            </div>
            <nav className="forum-quick-nav__list">
              <Link to="/community" className="forum-quick-nav__item forum-quick-nav__item--active">
                <span className="forum-quick-nav__item-icon">🏠</span>
                <span className="forum-quick-nav__item-label">Home</span>
              </Link>
              <Link to="/community?filter=new" className="forum-quick-nav__item">
                <span className="forum-quick-nav__item-icon">✨</span>
                <span className="forum-quick-nav__item-label">New Posts</span>
                <span className="forum-quick-nav__item-badge">24</span>
              </Link>
              <Link to="/community?filter=hot" className="forum-quick-nav__item">
                <span className="forum-quick-nav__item-icon">🔥</span>
                <span className="forum-quick-nav__item-label">Hot Topics</span>
              </Link>
              <Link to="/community?filter=unanswered" className="forum-quick-nav__item">
                <span className="forum-quick-nav__item-icon">❓</span>
                <span className="forum-quick-nav__item-label">Unanswered</span>
                <span className="forum-quick-nav__item-badge forum-quick-nav__item-badge--urgent">12</span>
              </Link>
              {user && (
                <>
                  <Link to="/community/bookmarks" className="forum-quick-nav__item">
                    <span className="forum-quick-nav__item-icon">🔖</span>
                    <span className="forum-quick-nav__item-label">Bookmarks</span>
                  </Link>
                  <Link to="/community/my-threads" className="forum-quick-nav__item">
                    <span className="forum-quick-nav__item-icon">📝</span>
                    <span className="forum-quick-nav__item-label">My Threads</span>
                  </Link>
                </>
              )}
            </nav>
          </div>

          {/* Tags Cloud */}
          <TagsCloud maxTags={10} />
        </aside>

        {/* Main Content */}
        <main className="forum-gaming-layout__main">
          {/* Trending Topics */}
          <TrendingTopics limit={4} />

          {/* Categories Section */}
          <section className="forum-categories-section">
            <div className="forum-section-header">
              <span className="forum-section-header__icon">📂</span>
              <h2 className="forum-section-header__title">Categories</h2>
            </div>

            {loading ? (
              <div className="forum-categories-loading">
                <div className="forum-categories-loading__grid">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="forum-categories-loading__card" />
                  ))}
                </div>
              </div>
            ) : (
              <ForumCategoryList categories={categories} onCategoryUpdate={loadCategories} />
            )}
          </section>
        </main>

        {/* Right Sidebar - Activity & Leaderboard */}
        <aside className="forum-gaming-layout__aside">
          {/* Activity Feed */}
          <ActivityFeed maxItems={8} />

          {/* Online Users */}
          <OnlineUsers maxVisible={5} />

          {/* Leaderboard */}
          <Leaderboard limit={5} />
        </aside>
      </div>
    </div>
  );
}
