import { useEffect, useState } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { studioApi, type StudioRevenueResponse } from '../../api/studio';

export function RevenueCard() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [data, setData] = useState<StudioRevenueResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, [period]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await studioApi.getRevenue({ period });
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ marginTop: 0 }}>Revenue</h3>
          <p style={{ margin: 0, color: 'var(--text-3)' }}>Gross, fee (10%), net</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['week', 'month', 'quarter'] as const).map(p => (
            <Button key={p} variant={period === p ? 'primary' : 'secondary'} size="small" onClick={() => setPeriod(p)}>
              {p}
            </Button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
        <Stat label="Gross" value={loading ? '…' : formatCurrency(data?.gross)} />
        <Stat label="Platform Fee" value={loading ? '…' : formatCurrency(data?.platformFee)} />
        <Stat label="Net" value={loading ? '…' : formatCurrency(data?.net)} />
      </div>

      {data?.topItems?.length ? (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>Top Items</div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {data.topItems.slice(0, 5).map(item => (
              <li key={item.itemId}>
                <span>{item.title || item.itemId}</span>
                <span style={{ color: 'var(--text-3)' }}> – {formatCurrency(item.gross)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '0.75rem 1rem' }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 18 }}>{value ?? '-'}</div>
    </div>
  );
}

function formatCurrency(amount?: number) {
  if (amount == null) return '-';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toFixed(0)}`;
  }
}


