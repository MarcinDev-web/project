import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/Button';
import type { MarketplaceItem } from '../../api/marketplace';

interface ProfileBuildsSectionProps {
  builds: MarketplaceItem[];
  userId: string;
  isOwnProfile: boolean;
  loading?: boolean;
}

const BuildCard = memo(function BuildCard({ build }: { build: MarketplaceItem }) {
  return (
    <Link to={`/marketplace/${build.id}`} style={{ textDecoration: 'none' }}>
      <div className="profile-build-card">
        <div className="profile-build-card__thumbnail">
          {build.thumbnailUrl ? (
            <img src={build.thumbnailUrl} alt={build.title} />
          ) : (
            <div className="profile-build-card__thumbnail-placeholder">
              <span className="profile-build-card__thumbnail-icon">🎮</span>
            </div>
          )}
        </div>
        
        <div className="profile-build-card__content">
          <h3 className="profile-build-card__title">{build.title}</h3>
          
          {build.description && (
            <p className="profile-build-card__description">{build.description}</p>
          )}
          
          <div className="profile-build-card__meta">
            {build.likesCount !== undefined && build.likesCount > 0 && (
              <span className="profile-build-card__stat">
                ❤️ {build.likesCount}
              </span>
            )}
            {build.downloadsCount !== undefined && build.downloadsCount > 0 && (
              <span className="profile-build-card__stat">
                ⬇️ {build.downloadsCount}
              </span>
            )}
            {build.viewsCount !== undefined && build.viewsCount > 0 && (
              <span className="profile-build-card__stat">
                👁️ {build.viewsCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});

/**
 * ProfileBuildsSection - Displays user's published builds with modern card design
 */
export const ProfileBuildsSection = memo(function ProfileBuildsSection({ 
  builds,
  userId,
  isOwnProfile,
  loading = false,
}: ProfileBuildsSectionProps) {
  if (loading) {
    return (
      <div className="profile-section">
        <div className="profile-section__header">
          <h3 className="profile-section__title">
            <span className="profile-section__title-icon">🎮</span>
            Opublikowane buildy
          </h3>
        </div>
        <div className="profile-section__content">
          <div className="profile-builds-grid">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="profile-skeleton" style={{ height: '280px' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-section" id="builds">
      <div className="profile-section__header">
        <h3 className="profile-section__title">
          <span className="profile-section__title-icon">🎮</span>
          Opublikowane buildy
          {builds.length > 0 && (
            <span style={{ 
              marginLeft: 'var(--spacing-2)',
              padding: 'var(--spacing-1) var(--spacing-2)',
              background: 'rgba(230, 126, 34, 0.2)',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--fw-accent-primary)',
            }}>
              {builds.length}
            </span>
          )}
        </h3>
        
        {builds.length > 0 && (
          <Link to={`/marketplace?author=${userId}`} className="profile-link-btn">
            Zobacz wszystko →
          </Link>
        )}
      </div>
      
      <div className="profile-section__content">
        {builds.length === 0 ? (
          <div className="profile-empty-state">
            <div className="profile-empty-state__illustration">
              <div className="profile-empty-state__icon">🏗️</div>
            </div>
            <h3 className="profile-empty-state__title">Brak opublikowanych buildów</h3>
            <p className="profile-empty-state__description">
              {isOwnProfile 
                ? 'Stwórz swój pierwszy build w edytorze i opublikuj go na marketplace!'
                : 'Ten użytkownik nie opublikował jeszcze żadnych buildów'}
            </p>
            {isOwnProfile && (
              <Link to="/editor" className="profile-link-btn profile-link-btn--primary profile-empty-state__action">
                🚀 Stwórz build
              </Link>
            )}
          </div>
        ) : (
          <div className="profile-builds-grid">
            {builds.slice(0, 6).map(build => (
              <BuildCard key={build.id} build={build} />
            ))}
          </div>
        )}
      </div>
      
      {builds.length > 6 && (
        <div className="profile-section__footer">
          <Link to={`/marketplace?author=${userId}`} className="profile-link-btn">
            Zobacz wszystkie {builds.length} buildów →
          </Link>
        </div>
      )}
    </div>
  );
});

