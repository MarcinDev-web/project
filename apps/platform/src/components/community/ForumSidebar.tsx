import styles from './ForumSidebar.module.css';
import { Link, useLocation } from 'react-router-dom';
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
    <div className={styles.sidebar}>
      {/* Search */}
      <div className={styles.section}>
        <ForumSearch />
      </div>

      {/* User Panel */}
      {user && (
        <div className={styles.section}>
          <div className={styles.title}>Account</div>
          <Link
            to={`/profile/${user.id}`}
            className={styles.userCard}
          >
            {userProfile && (
              <img
                src={userProfile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`}
                alt={displayName}
                className={styles.avatar}
              />
            )}
            <div className={styles.userInfo}>
              <div className={styles.displayName}>
                {displayName}
              </div>
              <div className={styles.role}>
                {user.role === 'admin' ? 'Administrator' : user.role === 'moderator' ? 'Moderator' : 'Member'}
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      {user && (
        <div className={styles.section}>
          <div className={styles.title}>Quick Actions</div>
          <nav>
            <ul className={styles.nav}>
              <li>
                <Link
                  to="/community/new-thread"
                  className={`${styles.link} ${
                    location.pathname === '/community/new-thread' ? styles.linkActive : ''
                  }`}
                >
                  <span>➕</span>
                  <span className={styles.linkName}>New Thread</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/community/my-threads"
                  className={`${styles.link} ${
                    location.pathname === '/community/my-threads' ? styles.linkActive : ''
                  }`}
                >
                  <span>📝</span>
                  <span className={styles.linkName}>My Threads</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/community/saved"
                  className={`${styles.link} ${
                    location.pathname === '/community/saved' ? styles.linkActive : ''
                  }`}
                >
                  <span>🔖</span>
                  <span className={styles.linkName}>Saved</span>
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      )}

      {/* Categories */}
      <div className={styles.section}>
        <div className={styles.title}>Categories</div>
        <nav aria-label="Forum categories">
          <ul className={styles.categoryNav}>
            {categories.map(category => (
              <li key={category.id} className={styles.categoryItem}>
                <Link
                  to={`/community/category/${category.id}`}
                  className={`${styles.link} ${
                    activeCategoryId === category.id ? styles.linkActive : ''
                  }`}
                >
                  {category.icon && (
                    <span className={styles.linkIcon} style={{ color: category.color }}>
                      {category.icon}
                    </span>
                  )}
                  <span className={styles.linkName}>{category.name}</span>
                  <span className={styles.linkCount}>
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
