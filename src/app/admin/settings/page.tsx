import { Metadata } from 'next';
import type { SessionUser } from '@/lib/auth/session';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import SettingsClient from './settings-client';

export const metadata: Metadata = {
  title: 'System Settings | InsightHub Admin',
  description: 'Configure feature flags, defaults, and system behavior',
};

export default async function SettingsPage() {
  // Auth-gate pattern — see src/app/admin/page.tsx for the full rationale.
  let user: SessionUser;
  try {
    user = await getCurrentUser();
  } catch {
    redirect('/dashboards?error=unauthorized');
  }

  if (user.role !== 'ADMIN') {
    redirect('/dashboards?error=access-denied');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">System Settings</h1>
        <p className="text-[var(--text-secondary)] mt-2">
          Configure feature flags, default behaviors, AI models, and maintenance mode.
        </p>
      </div>

      <SettingsClient />
    </div>
  );
}
