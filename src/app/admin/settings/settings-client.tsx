'use client';

import { useState, useEffect } from 'react';
import { SystemSettings } from '@/lib/settings';

const FEATURE_LABELS: Record<string, { label: string; description: string }> = {
  enableAIChat: { label: 'AI Chat', description: 'Natural language dashboard creation via Claude' },
  enableVoiceInput: { label: 'Voice Input', description: 'Whisper-powered speech-to-text in chat' },
  enableDashboardSharing: { label: 'Dashboard Sharing', description: 'Share dashboards with other users' },
  enableTemplates: { label: 'Templates', description: 'Dashboard templates and template gallery' },
  enableFolders: { label: 'Folders', description: 'Organize dashboards in nested folders' },
  enableDataExplorer: { label: 'Data Explorer', description: 'Schema browser and column profiling (Phase 3)' },
  enableQueryPlayground: { label: 'Query Playground', description: 'Interactive SQL scratch pad (Phase 3)' },
  enableSnowflakeConnector: { label: 'Snowflake Connector', description: 'Live Snowflake data source (Phase 3)' },
  enableCollaborativeEditing: { label: 'Collaborative Editing', description: 'Real-time multi-user editing (Phase 4)' },
  enableEmailNotifications: { label: 'Email Notifications', description: 'Send emails on share, alerts, digests' },
};

const ROLE_OPTIONS = ['VIEWER', 'CREATOR', 'POWER_USER', 'ADMIN'];

const AI_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
];

export default function SettingsClient() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await res.json();
      setSettings(data.settings);
      setDirty(false);
      setSuccessMessage('Settings saved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const updateFeature = (key: string, value: boolean) => {
    if (!settings) return;
    setSettings({
      ...settings,
      features: { ...settings.features, [key]: value },
    });
    setDirty(true);
  };

  const updateDefault = (key: string, value: string | number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      defaults: { ...settings.defaults, [key]: value },
    });
    setDirty(true);
  };

  const updateAI = (key: string, value: string | number | boolean) => {
    if (!settings) return;
    setSettings({
      ...settings,
      ai: { ...settings.ai, [key]: value },
    });
    setDirty(true);
  };

  const updateMaintenance = (key: string, value: string | boolean) => {
    if (!settings) return;
    setSettings({
      ...settings,
      maintenance: { ...settings.maintenance, [key]: value },
    });
    setDirty(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-400">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Save bar */}
      {dirty && (
        <div className="sticky top-4 z-10 flex items-center justify-between bg-accent-blue/10 border border-accent-blue/30 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-accent-blue">
            You have unsaved changes
          </span>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 disabled:opacity-50 text-sm font-medium"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-700 dark:text-green-400">{successMessage}</p>
        </div>
      )}

      {/* Feature Flags */}
      <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">Feature Flags</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Enable or disable platform features. Disabled features are hidden from all users.
          </p>
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          {Object.entries(settings.features).map(([key, enabled]) => {
            const meta = FEATURE_LABELS[key] || { label: key, description: '' };
            return (
              <div key={key} className="flex items-center justify-between px-6 py-4">
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{meta.label}</div>
                  <div className="text-xs text-[var(--text-muted)]">{meta.description}</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => updateFeature(key, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:bg-accent-blue peer-focus:ring-2 peer-focus:ring-accent-blue/30 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
            );
          })}
        </div>
      </section>

      {/* Defaults */}
      <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">Default Configuration</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            System-wide defaults for new users and resource limits.
          </p>
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Default Role for New Users</div>
              <div className="text-xs text-[var(--text-muted)]">Role assigned when a new user signs in for the first time</div>
            </div>
            <select
              value={settings.defaults.newUserRole}
              onChange={(e) => updateDefault('newUserRole', e.target.value)}
              className="text-sm border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg px-3 py-2"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Session Timeout (hours)</div>
              <div className="text-xs text-[var(--text-muted)]">How long before inactive sessions expire</div>
            </div>
            <input
              type="number"
              min={1}
              max={72}
              value={settings.defaults.sessionTimeoutHours}
              onChange={(e) => updateDefault('sessionTimeoutHours', parseInt(e.target.value) || 8)}
              className="w-20 text-sm border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Max Dashboards Per User</div>
              <div className="text-xs text-[var(--text-muted)]">Limit on total dashboards a user can own</div>
            </div>
            <input
              type="number"
              min={1}
              max={500}
              value={settings.defaults.maxDashboardsPerUser}
              onChange={(e) => updateDefault('maxDashboardsPerUser', parseInt(e.target.value) || 50)}
              className="w-20 text-sm border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Max Widgets Per Dashboard</div>
              <div className="text-xs text-[var(--text-muted)]">Maximum widgets allowed in a single dashboard</div>
            </div>
            <input
              type="number"
              min={10}
              max={500}
              value={settings.defaults.maxWidgetsPerDashboard}
              onChange={(e) => updateDefault('maxWidgetsPerDashboard', parseInt(e.target.value) || 100)}
              className="w-20 text-sm border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Chat Retention (days)</div>
              <div className="text-xs text-[var(--text-muted)]">Days before old chat messages are purged</div>
            </div>
            <input
              type="number"
              min={7}
              max={365}
              value={settings.defaults.chatRetentionDays}
              onChange={(e) => updateDefault('chatRetentionDays', parseInt(e.target.value) || 90)}
              className="w-20 text-sm border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg px-3 py-2"
            />
          </div>
        </div>
      </section>

      {/* AI Configuration */}
      <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">AI Configuration</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Configure which Claude models are used and response behavior.
          </p>
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Chat Model</div>
              <div className="text-xs text-[var(--text-muted)]">Primary model for dashboard generation and chat</div>
            </div>
            <select
              value={settings.ai.chatModel}
              onChange={(e) => updateAI('chatModel', e.target.value)}
              className="text-sm border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg px-3 py-2"
            >
              {AI_MODELS.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Explain Model</div>
              <div className="text-xs text-[var(--text-muted)]">Lighter model for metric explanations and tooltips</div>
            </div>
            <select
              value={settings.ai.explainModel}
              onChange={(e) => updateAI('explainModel', e.target.value)}
              className="text-sm border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg px-3 py-2"
            >
              {AI_MODELS.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Max Tokens Per Request</div>
              <div className="text-xs text-[var(--text-muted)]">Maximum output tokens for AI responses</div>
            </div>
            <input
              type="number"
              min={1024}
              max={16384}
              step={512}
              value={settings.ai.maxTokensPerRequest}
              onChange={(e) => updateAI('maxTokensPerRequest', parseInt(e.target.value) || 4096)}
              className="w-24 text-sm border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Streaming Responses</div>
              <div className="text-xs text-[var(--text-muted)]">Stream AI responses via SSE (disable for debugging)</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.ai.enableStreamingResponses}
                onChange={(e) => updateAI('enableStreamingResponses', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:bg-accent-blue peer-focus:ring-2 peer-focus:ring-accent-blue/30 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>
        </div>
      </section>

      {/* Maintenance Mode */}
      <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">Maintenance Mode</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Enable maintenance mode to block non-admin access during upgrades.
          </p>
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                Maintenance Mode
                {settings.maintenance.enabled && (
                  <span className="ml-2 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded">
                    ACTIVE
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--text-muted)]">When enabled, non-admin users see the maintenance message</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenance.enabled}
                onChange={(e) => updateMaintenance('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:bg-red-500 peer-focus:ring-2 peer-focus:ring-red-500/30 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          <div className="px-6 py-4">
            <div className="text-sm font-medium text-[var(--text-primary)] mb-2">Maintenance Message</div>
            <textarea
              value={settings.maintenance.message}
              onChange={(e) => updateMaintenance('message', e.target.value)}
              rows={2}
              className="w-full text-sm border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg px-3 py-2 resize-none"
            />
          </div>

          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Allow Admin Access During Maintenance</div>
              <div className="text-xs text-[var(--text-muted)]">Admins can still access the app when maintenance is on</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenance.allowAdminAccess}
                onChange={(e) => updateMaintenance('allowAdminAccess', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:bg-accent-blue peer-focus:ring-2 peer-focus:ring-accent-blue/30 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>
        </div>
      </section>

      {/* Bottom save button */}
      <div className="flex justify-end pb-8">
        <button
          onClick={saveSettings}
          disabled={saving || !dirty}
          className="px-6 py-3 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}
