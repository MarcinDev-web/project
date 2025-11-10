import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  style?: CSSProperties;
}

export function Skeleton({ width = '100%', height = '20px', borderRadius = 'var(--radius-md)', style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

interface MarketplaceCardSkeletonProps {
  count?: number;
}

/**
 * Skeleton loader for marketplace item cards
 */
export function MarketplaceCardSkeleton({ count = 1 }: MarketplaceCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="forge-card"
          style={{
            padding: 'var(--spacing-4)',
            pointerEvents: 'none',
          }}
        >
          {/* Thumbnail skeleton */}
          <Skeleton
            height="0"
            style={{
              width: '100%',
              paddingBottom: '56.25%', // 16:9 aspect ratio
              marginBottom: 'var(--spacing-4)',
            }}
          />

          {/* Title skeleton */}
          <Skeleton
            height="24px"
            width="80%"
            style={{ marginBottom: 'var(--spacing-2)' }}
          />

          {/* Description skeleton */}
          <Skeleton
            height="16px"
            width="100%"
            style={{ marginBottom: 'var(--spacing-1)' }}
          />
          <Skeleton
            height="16px"
            width="60%"
            style={{ marginBottom: 'var(--spacing-4)' }}
          />

          {/* Footer skeleton */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--spacing-4)' }}>
            {/* Author info */}
            <div>
              <Skeleton height="14px" width="100px" style={{ marginBottom: 'var(--spacing-1)' }} />
              <Skeleton height="14px" width="60px" />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
              <Skeleton width="40px" height="40px" borderRadius="var(--radius-md)" />
              <Skeleton width="60px" height="40px" borderRadius="var(--radius-md)" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

