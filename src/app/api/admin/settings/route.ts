import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getSystemSettings, saveSystemSettings } from '@/lib/settings';
import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit';
import { z } from 'zod';

// Full Zod schema matching the SystemSettings interface — validates every nesting level
const SettingsUpdateSchema = z.object({
  features: z.object({
    enableAIChat: z.boolean(),
    enableVoiceInput: z.boolean(),
    enableDashboardSharing: z.boolean(),
    enableTemplates: z.boolean(),
    enableFolders: z.boolean(),
    enableDataExplorer: z.boolean(),
    enableQueryPlayground: z.boolean(),
    enableSnowflakeConnector: z.boolean(),
    enableCollaborativeEditing: z.boolean(),
    enableEmailNotifications: z.boolean(),
  }).partial().optional(),
  defaults: z.object({
    newUserRole: z.enum(['VIEWER', 'CREATOR', 'POWER_USER', 'ADMIN']),
    sessionTimeoutHours: z.number().int().min(1).max(720),
    maxDashboardsPerUser: z.number().int().min(1).max(10000),
    maxWidgetsPerDashboard: z.number().int().min(1).max(500),
    chatRetentionDays: z.number().int().min(1).max(3650),
  }).partial().optional(),
  ai: z.object({
    chatModel: z.string().max(100),
    explainModel: z.string().max(100),
    maxTokensPerRequest: z.number().int().min(256).max(128000),
    enableStreamingResponses: z.boolean(),
  }).partial().optional(),
  maintenance: z.object({
    enabled: z.boolean(),
    message: z.string().max(500),
    allowAdminAccess: z.boolean(),
  }).partial().optional(),
}).strict();

// GET /api/admin/settings — Retrieve system settings
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const settings = await getSystemSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/settings — Update system settings
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();

    // Validate against full schema — rejects any unknown fields at every level
    const parseResult = SettingsUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid settings', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const filteredUpdate = parseResult.data;

    if (Object.keys(filteredUpdate).length === 0) {
      return NextResponse.json({ error: 'No valid settings provided' }, { status: 400 });
    }

    const previousSettings = await getSystemSettings();
    // Safe cast: deepMerge in saveSystemSettings fills missing fields from current settings
    const updatedSettings = await saveSystemSettings(filteredUpdate as Partial<import('@/lib/settings').SystemSettings>);

    // Audit log the change
    await createAuditLog({
      userId: user.id,
      action: AuditAction.SETTINGS_UPDATE,
      resourceType: ResourceType.SETTINGS,
      resourceId: 'system',
      metadata: {
        changedKeys: Object.keys(filteredUpdate),
        changedBy: user.email,
      },
    });

    return NextResponse.json({ settings: updatedSettings });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
