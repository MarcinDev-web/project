import { Link, useLocation } from 'react-router-dom';
import { Card } from '../shared/Card';
import { ForumSearch } from './ForumSearch';
import { useAuth } from '../../contexts/AuthContext';
import type { ForumCategory } from '../../api/forum';
import { useState, useEffect } from 'react';
import { profilesApi, type UserProfile } from '../../api/profiles';

export interface ForumSidebarProps {
  categories: ForumCategory[];
  activeCategoryId?: string;
}

/**
 * Forum Sidebar Component
 * 
 * Left sidebar with search, user panel, category navigation, and quick actions
 */
export function ForumSidebar({ categories, activeCategoryId }: ForumSidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (user) {
      void profilesApi.getProfile(user.id)
        .then(setUserProfile)
        .catch(() => setUserProfile(null));
    }
  }, [user]);

  const displayName = userProfile?.displayName || userProfile?.username || user?.username || userProfile?.email?.split('@')[0] || user?.email?.split('@')[0] || 'Guest';

  return (
    <div className="forum-sidebar">
      {/* Search */}
      <div className="forum-sidebar__section">
        <ForumSearch />
      </div>

      {/* User Panel */}
      {user && (
        <div className="forum-sidebar__section">
          <div className="forum-sidebar__title">Account</div>
          <Link
            to={`/profile/${user.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
              padding: 'var(--spacing-2)',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              color: 'var(--text-1)',
              transition: 'background var(--forum-transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--forum-bg-input)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {userProfile && (
              <img
                src={userProfile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`}
                alt={displayName}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-full)',
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>
                {displayName}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                {user.role === 'admin' ? 'Administrator' : user.role === 'moderator' ? 'Moderator' : 'Member'}
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      {user && (
        <div className="forum-sidebar__section">
          <div className="forum-sidebar__title">Quick Actions</div>
          <nav>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li>
                <Link
                  to="/community/new-thread"
                  className={`forum-category-nav__link ${
                    location.pathname === '/community/new-thread' ? 'forum-category-nav__link--active' : ''
                  }`}
                >
                  <span>➕</span>
                  <span className="forum-category-nav__name">New Thread</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/community/my-threads"
                  className={`forum-category-nav__link ${
                    location.pathname === '/community/my-threads' ? 'forum-category-nav__link--active' : ''
                  }`}
                >
                  <span>📝</span>
                  <span className="forum-category-nav__name">My Threads</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/community/saved"
                  className={`forum-category-nav__link ${
                    location.pathname === '/community/saved' ? 'forum-category-nav__link--active' : ''
                  }`}
                >
                  <span>🔖</span>
                  <span className="forum-category-nav__name">Saved</span>
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      )}

      {/* Categories */}
      <div className="forum-sidebar__section">
        <div className="forum-sidebar__title">Categories</div>
        <nav aria-label="Forum categories">
          <ul className="forum-category-nav">
            {categories.map(category => (
              <li key={category.id} className="forum-category-nav__item">
                <Link
                  to={`/community/category/${category.id}`}
                  className={`forum-category-nav__link ${
                    activeCategoryId === category.id ? 'forum-category-nav__link--active' : ''
                  }`}
                >
                  {category.icon && (
                    <span className="forum-category-nav__icon" style={{ color: category.color }}>
                      {category.icon}
                    </span>
                  )}
                  <span className="forum-category-nav__name">{category.name}</span>
                  <span className="forum-category-nav__count">
                    {category.threadCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

