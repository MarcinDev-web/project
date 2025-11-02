import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import type { MarketplaceItem } from '../../api/marketplace';

interface BuildsGridProps {
  builds: MarketplaceItem[];
  loading?: boolean;
}

const BuildCard = memo(function BuildCard({ build }: { build: MarketplaceItem }) {
  return (
    <Card hoverable={false}>
      <h3 
        style={{ 
          marginTop: 0, 
          marginBottom: 'var(--spacing-2)',
          color: 'var(--text-1)',
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-semibold)',
        }}
      >
        {build.title}
      </h3>
      
      {build.description && (
        <p 
          style={{ 
            color: 'var(--text-2)', 
            fontSize: 'var(--text-sm)',
            margin: 0,
            marginBottom: 'var(--spacing-4)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {build.description}
        </p>
      )}
      
      <Link 
        to={`/marketplace/${build.id}`}
        style={{ textDecoration: 'none' }}
        aria-label={`View ${build.title} build details`}
      >
        <Button 
          variant="secondary" 
          style={{ width: '100%' }}
        >
          Zobacz szczegóły
        </Button>
      </Link>
    </Card>
  );
});

export const BuildsGrid = memo(function BuildsGrid({ builds }: BuildsGridProps) {
  return (
    <div>
      <h2 
        style={{ 
          marginBottom: 'var(--spacing-4)',
          color: 'var(--text-1)',
          fontSize: 'var(--text-xl)',
          fontWeight: 'var(--font-semibold)',
        }}
      >
        Opublikowane buildy
      </h2>
      
      {builds.length === 0 ? (
        <Card hoverable={false}>
          <p 
            style={{ 
              color: 'var(--text-2)', 
              textAlign: 'center', 
              padding: 'var(--spacing-8)',
              margin: 0,
            }}
          >
            Brak opublikowanych buildów
          </p>
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 'var(--spacing-4)',
          }}
        >
          {builds.map(build => (
            <BuildCard key={build.id} build={build} />
          ))}
        </div>
      )}
    </div>
  );
});

