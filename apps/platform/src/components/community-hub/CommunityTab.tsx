import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ForumCategoryList } from '../community/ForumCategoryList';
import { forumApi, type ForumCategory, type ForumThread } from '../../api/forum';
import { useAuth } from '../../contexts/AuthContext';

export function CommunityTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [recentThreads, setRecentThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'recent' | 'popular'>('recent');

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [categoriesData, threadsData] = await Promise.all([
        forumApi.getCategories(),
        forumApi.getThreads({ sortBy: 'new', limit: 5 }),
      ]);
      setCategories(categoriesData || []);
      setRecentThreads(threadsData?.threads || []);
    } catch (error) {
      console.error('Failed to load forum data:', error);
      // Set empty arrays on error so UI doesn't break
      setCategories([]);
      setRecentThreads([]);
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

  const formatTimeAgo = (date: string | Date) => {
    const d = new Date(date);
    const now = Date.now();
    const diff = now - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="forum-unified">
      {/* Quick filters bar */}
      <div className="forum-unified__toolbar">
        <div className="forum-unified__filters">
          <button 
            className={`forum-unified__filter ${activeFilter === 'recent' ? 'forum-unified__filter--active' : ''}`}
            onClick={() => setActiveFilter('recent')}
          >
            🕐 Recent
          </button>
          <button 
            className={`forum-unified__filter ${activeFilter === 'popular' ? 'forum-unified__filter--active' : ''}`}
            onClick={() => setActiveFilter('popular')}
          >
            🔥 Popular
          </button>
          <Link to="/community/threads" className="forum-unified__filter">
            📋 All Threads
          </Link>
          {user && (
            <Link to="/community/my-threads" className="forum-unified__filter">
              📝 My Threads
            </Link>
          )}
        </div>
        <button onClick={handleNewThread} className="forum-unified__new-btn">
          + New Thread
        </button>
      </div>

      {/* Recent Discussions */}
      <section className="forum-unified__section">
        <h3 className="forum-unified__section-title">Recent Discussions</h3>

        {loading ? (
          <div className="forum-unified__loading">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="forum-unified__skeleton" />
            ))}
          </div>
        ) : recentThreads.length === 0 ? (
          <div className="forum-unified__empty">
            <p>No discussions yet. Be the first to start one!</p>
          </div>
        ) : (
          <div className="forum-unified__threads">
            {recentThreads.map(thread => (
              <Link 
                key={thread.id} 
                to={`/community/thread/${thread.id}`}
                className="forum-unified__thread"
              >
                <div className="forum-unified__thread-main">
                  <h4 className="forum-unified__thread-title">{thread.title}</h4>
                  <div className="forum-unified__thread-meta">
                    <span className="forum-unified__thread-author">{thread.authorName}</span>
                    <span className="forum-unified__thread-dot">·</span>
                    <span className="forum-unified__thread-time">{formatTimeAgo(thread.createdAt)}</span>
                    {thread.categoryName && (
                      <>
                        <span className="forum-unified__thread-dot">·</span>
                        <span className="forum-unified__thread-category">{thread.categoryName}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="forum-unified__thread-stats">
                  <span className="forum-unified__thread-replies">{thread.postCount}</span>
                  <span className="forum-unified__thread-replies-label">replies</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Categories */}
      <section className="forum-unified__section">
        <h3 className="forum-unified__section-title">Categories</h3>

        {loading ? (
          <div className="forum-unified__categories-loading">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="forum-unified__skeleton forum-unified__skeleton--card" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="forum-unified__empty">
            <p>No categories yet</p>
          </div>
        ) : (
          <ForumCategoryList categories={categories} onCategoryUpdate={loadData} />
        )}
      </section>
    </div>
  );
}
