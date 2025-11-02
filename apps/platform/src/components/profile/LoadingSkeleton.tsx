import { Card } from '../shared/Card';

export function ProfileLoadingSkeleton() {
  const skeletonStyle: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-md)',
    animation: 'pulse 1.5s ease-in-out infinite',
  };

  return (
    <div className="page-container">
      <Card style={{ marginBottom: 'var(--spacing-6)' }} hoverable={false}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
          {/* Avatar skeleton */}
          <div
            style={{
              ...skeletonStyle,
              width: '80px',
              height: '80px',
              borderRadius: 'var(--radius-full)',
            }}
          />
          <div style={{ flex: 1 }}>
            {/* Name skeleton */}
            <div
              style={{
                ...skeletonStyle,
                height: '32px',
                width: '200px',
                marginBottom: 'var(--spacing-2)',
              }}
            />
            {/* Bio skeleton */}
            <div
              style={{
                ...skeletonStyle,
                height: '20px',
                width: '300px',
                marginBottom: 'var(--spacing-2)',
              }}
            />
            {/* Date skeleton */}
            <div
              style={{
                ...skeletonStyle,
                height: '16px',
                width: '150px',
              }}
            />
          </div>
        </div>
      </Card>

      {/* Builds section skeleton */}
      <div
        style={{
          ...skeletonStyle,
          height: '32px',
          width: '180px',
          marginBottom: 'var(--spacing-4)',
        }}
      />
      
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 'var(--spacing-4)',
        }}
      >
        {[1, 2, 3].map(i => (
          <Card key={i} hoverable={false}>
            <div
              style={{
                ...skeletonStyle,
                height: '24px',
                width: '80%',
                marginBottom: 'var(--spacing-2)',
              }}
            />
            <div
              style={{
                ...skeletonStyle,
                height: '16px',
                width: '100%',
                marginBottom: 'var(--spacing-1)',
              }}
            />
            <div
              style={{
                ...skeletonStyle,
                height: '16px',
                width: '60%',
              }}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}

