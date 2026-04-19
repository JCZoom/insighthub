import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const SETTINGS_DIR = join(process.cwd(), 'data');
const SETTINGS_FILE = join(SETTINGS_DIR, 'system-settings.json');

export interface SystemSettings {
  // Feature flags
  features: {
    enableAIChat: boolean;
    enableVoiceInput: boolean;
    enableDashboardSharing: boolean;
    enableTemplates: boolean;
    enableFolders: boolean;
    enableDataExplorer: boolean;
    enableQueryPlayground: boolean;
    enableSnowflakeConnector: boolean;
    enableCollaborativeEditing: boolean;
    enableEmailNotifications: boolean;
  };

  // Default configurations
  defaults: {
    newUserRole: 'VIEWER' | 'CREATOR' | 'POWER_USER' | 'ADMIN';
    sessionTimeoutHours: number;
    maxDashboardsPerUser: number;
    maxWidgetsPerDashboard: number;
    chatRetentionDays: number;
  };

  // AI configuration
  ai: {
    chatModel: string;
    explainModel: string;
    maxTokensPerRequest: number;
    enableStreamingResponses: boolean;
  };

  // Maintenance
  maintenance: {
    enabled: boolean;
    message: string;
    allowAdminAccess: boolean;
  };
}

const DEFAULT_SETTINGS: SystemSettings = {
  features: {
    enableAIChat: true,
    enableVoiceInput: true,
    enableDashboardSharing: true,
    enableTemplates: true,
    enableFolders: true,
    enableDataExplorer: false,
    enableQueryPlayground: false,
    enableSnowflakeConnector: false,
    enableCollaborativeEditing: false,
    enableEmailNotifications: false,
  },
  defaults: {
    newUserRole: 'VIEWER',
    sessionTimeoutHours: 8,
    maxDashboardsPerUser: 50,
    maxWidgetsPerDashboard: 100,
    chatRetentionDays: 90,
  },
  ai: {
    chatModel: 'claude-sonnet-4-20250514',
    explainModel: 'claude-sonnet-4-20250514',
    maxTokensPerRequest: 4096,
    enableStreamingResponses: true,
  },
  maintenance: {
    enabled: false,
    message: 'InsightHub is currently undergoing maintenance. Please check back shortly.',
    allowAdminAccess: true,
  },
};

/**
 * Read system settings from file, returning defaults if file doesn't exist.
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf-8');
    const saved = JSON.parse(raw);
    // Deep merge with defaults to ensure new fields are always present
    return deepMerge(DEFAULT_SETTINGS, saved) as SystemSettings;
  } catch {
    // File doesn't exist or is invalid — return defaults
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save system settings to file.
 */
export async function saveSystemSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
  const current = await getSystemSettings();
  const merged = deepMerge(current, settings) as SystemSettings;

  await mkdir(SETTINGS_DIR, { recursive: true });
  await writeFile(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8');

  return merged;
}

/**
 * Get a single feature flag value.
 */
export async function isFeatureEnabled(feature: keyof SystemSettings['features']): Promise<boolean> {
  const settings = await getSystemSettings();
  return settings.features[feature] ?? false;
}

/**
 * Deep merge utility — source values override target.
 */
function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    // Prototype pollution guard
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
