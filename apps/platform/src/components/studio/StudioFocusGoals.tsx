import { useEffect, useState } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { studioApi, type StudioSettings } from '../../api/studio';
import { useToast } from '../../contexts/ToastContext';

export function StudioFocusGoals() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    const s = await studioApi.getSettings();
    setSettings(s);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (!settings) return;
      const updated = await studioApi.updateSettings({
        focus: settings.focus,
        goals: settings.goals,
        cadenceTarget: settings.cadenceTarget,
        showRevenue: settings.showRevenue,
      });
      setSettings(updated);
      showToast('Ustawienia zapisane', 'success');
    } catch (e) {
      showToast('Nie udało się zapisać', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <Card>
        <p>Ładowanie ustawień...</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>Focus & Goals</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)' }}>Studio Focus</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {(['games', 'assets', 'balanced'] as const).map(f => (
              <label key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="focus"
                  checked={settings.focus === f}
                  onChange={() => setSettings({ ...settings, focus: f })}
                />
                <span style={{ textTransform: 'capitalize' }}>{f}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <NumberField
            label="Revenue target (month)"
            value={settings.goals.monthlyRevenueTarget ?? 0}
            onChange={(v) => setSettings({ ...settings, goals: { ...settings.goals, monthlyRevenueTarget: v } })}
          />
          <NumberField
            label="Releases / month"
            value={settings.goals.monthlyReleasesTarget ?? 0}
            onChange={(v) => setSettings({ ...settings, goals: { ...settings.goals, monthlyReleasesTarget: v } })}
          />
          <NumberField
            label="Updates / month"
            value={settings.goals.monthlyUpdatesTarget ?? settings.cadenceTarget}
            onChange={(v) => setSettings({ ...settings, cadenceTarget: v, goals: { ...settings.goals, monthlyUpdatesTarget: v } })}
          />
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={settings.showRevenue}
              onChange={(e) => setSettings({ ...settings, showRevenue: e.target.checked })}
            />
            <span>Pokaż panel przychodu</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Zapisywanie…' : 'Zapisz ustawienia'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)' }}>{label}</label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseInt(e.target.value || '0', 10))}
        style={{ width: '100%' }}
      />
    </div>
  );
}


