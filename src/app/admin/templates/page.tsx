import { Metadata } from 'next';
import type { SessionUser } from '@/lib/auth/session';
import { getCurrentUser } from '@/lib/auth/session';
import { hasFeaturePermission } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import TemplateManagementClient from './template-management-client';

export const metadata: Metadata = {
  title: 'Template Management | InsightHub Admin',
  description: 'Manage dashboard templates and promote dashboards to the template gallery',
};

export default async function TemplateManagementPage() {
  // Auth-gate pattern — see src/app/admin/page.tsx for the full rationale.
  let user: SessionUser;
  try {
    user = await getCurrentUser();
  } catch {
    redirect('/dashboards?error=unauthorized');
  }

  // canManageUsers is used as a proxy for admin-equivalent template authority.
  const canManageUsers = await hasFeaturePermission(user, 'canManageUsers');
  const canManagePermissions = await hasFeaturePermission(user, 'canManagePermissions');

  if (!canManageUsers && !canManagePermissions) {
    redirect('/dashboards?error=access-denied');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Template Management</h1>
        <p className="text-[var(--text-secondary)] mt-2">
          Manage the dashboard template gallery. Promote high-quality dashboards to templates for the organization.
        </p>
      </div>

      <TemplateManagementClient currentUser={user} />
    </div>
  );
}