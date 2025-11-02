import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';
import { Button } from '../components/shared/Button';
import { settingsApi, type UserSettings } from '../api/settings';

export function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await settingsApi.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = (key: keyof UserSettings['notificationPreferences'], value: boolean) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      notificationPreferences: {
        ...settings.notificationPreferences,
        [key]: value,
      },
    });
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const updated = await settingsApi.updateSettings({
        notificationPreferences: settings.notificationPreferences,
      });
      setSettings(updated);
      alert('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <Layout>
        <div className="page-container">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container">
        <h1 style={{ marginBottom: 'var(--spacing-6)' }}>Settings</h1>

        <Card style={{ marginBottom: 'var(--spacing-6)' }}>
          <h2 style={{ marginTop: 0, marginBottom: 'var(--spacing-4)' }}>Notification Preferences</h2>
          <p style={{ color: 'var(--text-2)', fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-4)' }}>
            Choose which notifications you want to receive
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
            {Object.entries(settings.notificationPreferences).map(([key, value]) => (
              <label
                key={key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--spacing-3)',
                  background: 'var(--bg-button)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ color: 'var(--text-1)' }}>
                  {key === 'messages' && 'New Messages'}
                  {key === 'friendRequests' && 'Friend Requests'}
                  {key === 'friendAccepted' && 'Friend Request Accepted'}
                  {key === 'groupInvites' && 'Group Invites'}
                  {key === 'system' && 'System Notifications'}
                </span>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => handlePreferenceChange(key as keyof UserSettings['notificationPreferences'], e.target.checked)}
                  style={{
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                  }}
                />
              </label>
            ))}
          </div>

          <div style={{ marginTop: 'var(--spacing-6)', display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

