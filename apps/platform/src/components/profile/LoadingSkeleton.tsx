/**
 * ProfileLoadingSkeleton - Modern loading skeleton for profile page
 * Matches the new two-column layout design
 */
export function ProfileLoadingSkeleton() {
  return (
    <div className="page-container">
      <div className="profile-layout">
        {/* Hero Skeleton */}
        <div className="profile-hero" style={{ gridColumn: '1 / -1' }}>
          <div 
            className="profile-skeleton" 
            style={{ height: '180px', borderRadius: 0 }} 
          />
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-end',
            gap: 'var(--spacing-5)', 
            padding: 'var(--spacing-5)',
            marginTop: '-80px',
          }}>
            {/* Avatar skeleton */}
            <div
              className="profile-skeleton"
              style={{
                width: '120px',
                height: '120px',
                borderRadius: 'var(--radius-xl)',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, paddingBottom: 'var(--spacing-2)' }}>
              {/* Name skeleton */}
              <div
                className="profile-skeleton"
                style={{
                  height: '32px',
                  width: '220px',
                  marginBottom: 'var(--spacing-3)',
                }}
              />
              {/* Bio skeleton */}
              <div
                className="profile-skeleton"
                style={{
                  height: '20px',
                  width: '340px',
                  marginBottom: 'var(--spacing-3)',
                }}
              />
              {/* Meta skeleton */}
              <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
                <div className="profile-skeleton" style={{ height: '16px', width: '100px' }} />
                <div className="profile-skeleton" style={{ height: '16px', width: '80px' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Skeleton */}
        <div className="profile-sidebar">
          <div className="profile-sidebar__card">
            <div className="profile-skeleton" style={{ height: '20px', width: '100px', marginBottom: 'var(--spacing-4)' }} />
            <div className="profile-quick-stats">
              {[1, 2, 3, 4].map(i => (
                <div 
                  key={i} 
                  className="profile-skeleton" 
                  style={{ height: '80px' }} 
                />
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="profile-main">
          {/* Stats Grid Skeleton */}
          <div className="profile-stats-grid">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div 
                key={i} 
                className="profile-skeleton" 
                style={{ height: '140px' }} 
              />
            ))}
          </div>

          {/* Activity Section Skeleton */}
          <div className="profile-section">
            <div className="profile-section__header">
              <div className="profile-skeleton" style={{ height: '24px', width: '180px' }} />
            </div>
            <div className="profile-section__content">
              {[1, 2, 3].map(i => (
                <div 
                  key={i} 
                  className="profile-skeleton" 
                  style={{ height: '72px', marginBottom: 'var(--spacing-3)' }} 
                />
              ))}
            </div>
          </div>

          {/* Builds Section Skeleton */}
          <div className="profile-section">
            <div className="profile-section__header">
              <div className="profile-skeleton" style={{ height: '24px', width: '200px' }} />
            </div>
            <div className="profile-section__content">
              <div className="profile-builds-grid">
                {[1, 2, 3].map(i => (
                  <div 
                    key={i} 
                    className="profile-skeleton" 
                    style={{ height: '280px' }} 
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
