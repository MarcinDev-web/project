import { Card } from '../shared/Card';
import { Button } from '../shared/Button';

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="page-container">
      <Card hoverable={false}>
        <div 
          style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-6)',
          }}
        >
          <h1 
            style={{ 
              marginTop: 0, 
              marginBottom: 'var(--spacing-3)',
              color: 'var(--color-error)',
              fontSize: 'var(--text-xl)',
            }}
          >
            Błąd ładowania profilu
          </h1>
          
          <p 
            style={{ 
              color: 'var(--text-2)', 
              marginBottom: 'var(--spacing-6)',
              fontSize: 'var(--text-base)',
            }}
          >
            {error}
          </p>
          
          <Button 
            onClick={onRetry}
            aria-label="Spróbuj ponownie załadować profil"
          >
            Spróbuj ponownie
          </Button>
        </div>
      </Card>
    </div>
  );
}

