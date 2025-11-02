import { useEffect, useState } from 'react';
import { Card } from '../shared/Card';
import { studioApi } from '../../api/studio';

export function InsightsList() {
  const [insights, setInsights] = useState<Array<{ id: string; message: string; impact: 'low'|'medium'|'high'; action?: { type: string; href?: string } }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await studioApi.getInsights();
      setInsights(res.insights || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>Insights</h3>
      {loading ? (
        <p>Ładowanie...</p>
      ) : insights.length === 0 ? (
        <p>Brak zaleceń teraz — rób swoje 👌</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 16, display: 'grid', gap: 8 }}>
          {insights.map((i) => (
            <li key={i.id} style={{ color: 'var(--text-2)' }}>
              <span style={{ marginRight: 8 }}>
                {i.impact === 'high' ? '🔥' : i.impact === 'medium' ? '💡' : '✳️'}
              </span>
              <span>{i.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}


