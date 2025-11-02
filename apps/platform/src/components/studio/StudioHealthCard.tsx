import { useEffect, useState } from 'react';
import { Card } from '../shared/Card';
import { studioApi } from '../../api/studio';

export function StudioHealthCard() {
  const [score, setScore] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await studioApi.getScore();
      setScore(res.score);
      setBreakdown(res.breakdown);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ marginTop: 0 }}>Studio Health</h3>
          <p style={{ margin: 0, color: 'var(--text-3)' }}>Composite score (0–100)</p>
        </div>
        <div style={{ fontSize: '2.25rem', fontWeight: 700 }}>{loading ? '…' : (score ?? 0)}</div>
      </div>
      {breakdown && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
          {Object.entries(breakdown).map(([k, v]) => (
            <div key={k} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'capitalize' }}>{k}</div>
              <div style={{ fontWeight: 600 }}>{Math.round(v)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}


