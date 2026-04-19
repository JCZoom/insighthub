import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getSystemSettings, saveSystemSettings } from '@/lib/settings';
import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit';

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

    // Only allow known top-level keys
    const allowedKeys = ['features', 'defaults', 'ai', 'maintenance'];
    const filteredUpdate: Record<string, any> = {};
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        filteredUpdate[key] = body[key];
      }
    }

    if (Object.keys(filteredUpdate).length === 0) {
      return NextResponse.json({ error: 'No valid settings provided' }, { status: 400 });
    }

    const previousSettings = await getSystemSettings();
    const updatedSettings = await saveSystemSettings(filteredUpdate);

    // Audit log the change
    await createAuditLog({
      userId: user.id,
      action: 'settings.update' as AuditAction,
      resourceType: 'settings' as ResourceType,
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
